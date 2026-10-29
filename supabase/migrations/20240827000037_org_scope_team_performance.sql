-- Org-scope team performance RPCs missed by 00036.
-- Super Admin scope_all must mean "all members in current organization",
-- not the whole database.

CREATE OR REPLACE FUNCTION public.report_member_stats(
  p_assignee_ids uuid[],
  p_scope_all boolean,
  p_campaign_id uuid,
  p_response text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  member_id uuid,
  total_contacts bigint,
  completed bigint,
  remaining bigint,
  coming bigint,
  not_coming bigint,
  unreachable bigint,
  switched_off bigint,
  wrong_number bigint,
  other bigint,
  total_attempts bigint,
  last_attempt_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  actor_org uuid;
  v_has_period boolean := p_from IS NOT NULL OR p_to IS NOT NULL;
BEGIN
  actor_org := public.current_organization_id();
  IF actor_org IS NULL THEN
    RETURN;
  END IF;

  IF NOT v_has_period AND p_response IS NULL THEN
    RETURN QUERY
    SELECT
      s.assignee_id,
      sum(s.total_contacts)::bigint,
      sum(s.completed)::bigint,
      sum(s.remaining)::bigint,
      sum(s.coming)::bigint,
      sum(s.not_coming)::bigint,
      sum(s.unreachable)::bigint,
      sum(s.switched_off)::bigint,
      sum(s.wrong_number)::bigint,
      sum(s.other)::bigint,
      sum(s.total_attempts)::bigint,
      max(s.last_attempt_at)
    FROM public.campaign_assignee_stats s
    WHERE s.organization_id = actor_org
      AND s.assignee_id <> '00000000-0000-0000-0000-000000000000'::uuid
      AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id)
    GROUP BY s.assignee_id
    HAVING sum(s.total_contacts) > 0;
    RETURN;
  END IF;

  RETURN QUERY
  WITH u AS (
    SELECT *
    FROM public.report_contact_universe(
      p_assignee_ids, p_scope_all, p_campaign_id, p_response, p_from, p_to
    ) x
    WHERE x.current_assignee_id IS NOT NULL
  ),
  ms AS (
    SELECT
      u.current_assignee_id AS mid,
      count(*)::bigint AS total_contacts,
      count(*) FILTER (WHERE u.response IS NOT NULL)::bigint AS completed,
      count(*) FILTER (WHERE u.response IS NULL)::bigint AS remaining,
      count(*) FILTER (WHERE u.response = 'COMING')::bigint AS coming,
      count(*) FILTER (WHERE u.response = 'NOT_COMING')::bigint AS not_coming,
      count(*) FILTER (WHERE u.response = 'UNREACHABLE')::bigint AS unreachable,
      count(*) FILTER (WHERE u.response = 'SWITCHED_OFF')::bigint AS switched_off,
      count(*) FILTER (WHERE u.response = 'WRONG_NUMBER')::bigint AS wrong_number,
      count(*) FILTER (WHERE u.response = 'OTHER')::bigint AS other,
      COALESCE(sum(u.attempt_count), 0)::bigint AS all_time_attempts,
      max(u.last_attempt_at) AS all_time_last
    FROM u
    GROUP BY u.current_assignee_id
  ),
  pa AS (
    SELECT
      u.current_assignee_id AS mid,
      count(*)::bigint AS window_attempts,
      max(ca.attempted_at) AS window_last
    FROM public.call_attempts ca
    INNER JOIN u ON u.contact_id = ca.contact_id
    WHERE v_has_period
      AND ca.organization_id = actor_org
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to)
    GROUP BY u.current_assignee_id
  )
  SELECT
    ms.mid,
    ms.total_contacts,
    ms.completed,
    ms.remaining,
    ms.coming,
    ms.not_coming,
    ms.unreachable,
    ms.switched_off,
    ms.wrong_number,
    ms.other,
    CASE WHEN v_has_period THEN COALESCE(pa.window_attempts, 0)
         ELSE ms.all_time_attempts END,
    CASE WHEN v_has_period THEN pa.window_last ELSE ms.all_time_last END
  FROM ms
  LEFT JOIN pa ON pa.mid = ms.mid;
END;
$$;

REVOKE ALL ON FUNCTION public.report_member_stats(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_report_team_performance(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_org UUID;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized for team performance stats';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN jsonb_build_object(
      'memberRows', '[]'::jsonb,
      'governorRows', '[]'::jsonb
    );
  END IF;

  WITH ms AS (
    SELECT *
    FROM public.report_member_stats(
      p_assignee_ids, p_scope_all, p_campaign_id, p_response, p_from, p_to
    )
  ),
  governor_map AS (
    SELECT
      t.id AS member_id,
      CASE t.role
        WHEN 'GOVERNOR' THEN t.id
        WHEN 'LEADER' THEN t.governor_id
        WHEN 'TELEPASTOR' THEN COALESCE(leader.governor_id, t.governor_id)
        ELSE NULL
      END AS governor_id
    FROM public.telepastors t
    LEFT JOIN public.telepastors leader ON leader.id = t.leader_id
    WHERE t.organization_id = actor_org
      AND (leader.id IS NULL OR leader.organization_id = actor_org)
  ),
  member_rows AS (
    SELECT
      jsonb_build_object(
        'memberId', t.id,
        'memberName', t.name,
        'memberRole', t.role::text,
        'totalContacts', ms.total_contacts,
        'assigned', ms.total_contacts,
        'unassigned', 0,
        'completed', ms.completed,
        'remaining', ms.remaining,
        'coming', ms.coming,
        'notComing', ms.not_coming,
        'unreachable', ms.unreachable,
        'switchedOff', ms.switched_off,
        'wrongNumber', ms.wrong_number,
        'other', ms.other,
        'totalCallAttempts', ms.total_attempts,
        'lastAttemptAt', ms.last_attempt_at
      ) AS row,
      ms.completed
    FROM ms
    INNER JOIN public.telepastors t ON t.id = ms.member_id
    WHERE t.organization_id = actor_org
      AND t.is_active
      AND t.role IN ('LEADER', 'TELEPASTOR')
      AND (ms.total_contacts > 0 OR ms.total_attempts > 0)
  ),
  governor_rows AS (
    SELECT
      jsonb_build_object(
        'memberId', g.id,
        'memberName', g.name,
        'memberRole', g.role::text,
        'totalContacts', sum(ms.total_contacts),
        'assigned', sum(ms.total_contacts),
        'unassigned', 0,
        'completed', sum(ms.completed),
        'remaining', sum(ms.remaining),
        'coming', sum(ms.coming),
        'notComing', sum(ms.not_coming),
        'unreachable', sum(ms.unreachable),
        'switchedOff', sum(ms.switched_off),
        'wrongNumber', sum(ms.wrong_number),
        'other', sum(ms.other),
        'totalCallAttempts', sum(ms.total_attempts),
        'lastAttemptAt', max(ms.last_attempt_at)
      ) AS row,
      sum(ms.completed) AS completed
    FROM ms
    INNER JOIN governor_map gm ON gm.member_id = ms.member_id
    INNER JOIN public.telepastors g
      ON g.id = gm.governor_id
     AND g.organization_id = actor_org
     AND g.role = 'GOVERNOR'
     AND g.is_active
    GROUP BY g.id, g.name, g.role
    HAVING sum(ms.total_contacts) > 0
        OR sum(ms.total_attempts) > 0
  )
  SELECT jsonb_build_object(
    'memberRows', COALESCE(
      (
        SELECT jsonb_agg(member_rows.row ORDER BY member_rows.completed DESC)
        FROM member_rows
      ),
      '[]'::jsonb
    ),
    'governorRows', COALESCE(
      (
        SELECT jsonb_agg(governor_rows.row ORDER BY governor_rows.completed DESC)
        FROM governor_rows
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN COALESCE(
    v_result,
    jsonb_build_object('memberRows', '[]'::jsonb, 'governorRows', '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_call_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_org UUID;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'assigned', COALESCE(sum(s.total_contacts), 0)::bigint,
    'completed', COALESCE(sum(s.completed), 0)::bigint,
    'remaining', COALESCE(sum(s.remaining), 0)::bigint,
    'coming', COALESCE(sum(s.coming), 0)::bigint,
    'notComing', COALESCE(sum(s.not_coming), 0)::bigint,
    'unreachable', COALESCE(sum(s.unreachable), 0)::bigint,
    'switchedOff', COALESCE(sum(s.switched_off), 0)::bigint,
    'wrongNumber', COALESCE(sum(s.wrong_number), 0)::bigint,
    'other', COALESCE(sum(s.other), 0)::bigint,
    'contactsWithNotes', COALESCE(sum(s.with_notes), 0)::bigint
  )
  INTO v_result
  FROM public.campaign_assignee_stats s
  WHERE s.assignee_id = actor_id
    AND s.organization_id = actor_org;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_team_performance(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_call_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
