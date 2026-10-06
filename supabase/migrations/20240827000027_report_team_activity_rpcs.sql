-- Fast team-performance + recent-activity aggregates for reports/dashboard.
-- Shared contact universe keeps headline and team counts on the same definition.
-- SECURITY DEFINER avoids per-row RLS while still gating on ministry role.

CREATE INDEX IF NOT EXISTS call_attempts_contact_id_attempted_at_idx
  ON public.call_attempts (contact_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS call_attempts_campaign_id_attempted_at_idx
  ON public.call_attempts (campaign_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS contacts_current_assignee_campaign_idx
  ON public.contacts (current_assignee_id, campaign_id);

CREATE OR REPLACE FUNCTION public.report_contact_universe(
  p_assignee_ids uuid[],
  p_scope_all boolean,
  p_campaign_id uuid,
  p_response text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  contact_id uuid,
  campaign_id uuid,
  current_assignee_id uuid,
  response public.call_response,
  latest_notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NOT NULL OR p_to IS NOT NULL THEN
    RETURN QUERY
    SELECT
      period.contact_id,
      period.campaign_id,
      period.current_assignee_id,
      period.response,
      period.latest_notes
    FROM (
      SELECT DISTINCT ON (ca.contact_id)
        ca.contact_id,
        c.campaign_id,
        c.current_assignee_id,
        ca.response,
        c.latest_notes
      FROM public.call_attempts ca
      INNER JOIN public.contacts c ON c.id = ca.contact_id
      WHERE (
          p_scope_all
          OR c.current_assignee_id = ANY (p_assignee_ids)
        )
        AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR ca.attempted_at >= p_from)
        AND (p_to IS NULL OR ca.attempted_at <= p_to)
      ORDER BY ca.contact_id, ca.attempted_at DESC
    ) period
    WHERE p_response IS NULL OR period.response::text = p_response;
  ELSE
    RETURN QUERY
    SELECT
      c.id,
      c.campaign_id,
      c.current_assignee_id,
      c.latest_response,
      c.latest_notes
    FROM public.contacts c
    WHERE (
        p_scope_all
        OR c.current_assignee_id = ANY (p_assignee_ids)
      )
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR c.latest_response::text = p_response);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_contact_universe(
  uuid[],
  boolean,
  uuid,
  text,
  timestamptz,
  timestamptz
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_leadership_dashboard_stats(
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
  v_total bigint := 0;
  v_assigned bigint := 0;
  v_unassigned bigint := 0;
  v_completed bigint := 0;
  v_remaining bigint := 0;
  v_coming bigint := 0;
  v_not_coming bigint := 0;
  v_unreachable bigint := 0;
  v_switched_off bigint := 0;
  v_wrong_number bigint := 0;
  v_other bigint := 0;
  v_notes bigint := 0;
  v_active_campaigns bigint := 0;
  v_attempts bigint := 0;
  v_has_period boolean := false;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized for leadership dashboard stats';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN jsonb_build_object(
      'totalContacts', 0,
      'assigned', 0,
      'unassigned', 0,
      'completed', 0,
      'remaining', 0,
      'coming', 0,
      'notComing', 0,
      'unreachable', 0,
      'switchedOff', 0,
      'wrongNumber', 0,
      'other', 0,
      'contactsWithNotes', 0,
      'activeCampaigns', 0,
      'totalCallAttempts', 0
    );
  END IF;

  v_has_period := p_from IS NOT NULL OR p_to IS NOT NULL;

  SELECT
    count(*),
    count(*) FILTER (WHERE u.current_assignee_id IS NOT NULL),
    count(*) FILTER (WHERE u.current_assignee_id IS NULL),
    count(*) FILTER (WHERE u.response IS NOT NULL),
    count(*) FILTER (WHERE u.response IS NULL),
    count(*) FILTER (WHERE u.response = 'COMING'),
    count(*) FILTER (WHERE u.response = 'NOT_COMING'),
    count(*) FILTER (WHERE u.response = 'UNREACHABLE'),
    count(*) FILTER (WHERE u.response = 'SWITCHED_OFF'),
    count(*) FILTER (WHERE u.response = 'WRONG_NUMBER'),
    count(*) FILTER (WHERE u.response = 'OTHER'),
    count(*) FILTER (
      WHERE u.latest_notes IS NOT NULL AND length(btrim(u.latest_notes)) > 0
    )
  INTO
    v_total,
    v_assigned,
    v_unassigned,
    v_completed,
    v_remaining,
    v_coming,
    v_not_coming,
    v_unreachable,
    v_switched_off,
    v_wrong_number,
    v_other,
    v_notes
  FROM public.report_contact_universe(
    p_assignee_ids,
    p_scope_all,
    p_campaign_id,
    p_response,
    p_from,
    p_to
  ) u;

  IF p_scope_all AND NOT v_has_period THEN
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id);
  ELSIF v_has_period THEN
    SELECT count(DISTINCT u.campaign_id)
    INTO v_active_campaigns
    FROM public.report_contact_universe(
      p_assignee_ids,
      p_scope_all,
      p_campaign_id,
      p_response,
      p_from,
      p_to
    ) u
    INNER JOIN public.campaigns camp ON camp.id = u.campaign_id
    WHERE camp.status = 'ACTIVE';
  ELSE
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
      AND EXISTS (
        SELECT 1
        FROM public.contacts c
        WHERE c.campaign_id = camp.id
          AND c.current_assignee_id = ANY (p_assignee_ids)
      );
  END IF;

  SELECT count(*)
  INTO v_attempts
  FROM public.call_attempts ca
  WHERE (p_from IS NULL OR ca.attempted_at >= p_from)
    AND (p_to IS NULL OR ca.attempted_at <= p_to)
    AND EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.id = ca.contact_id
        AND (
          p_scope_all
          OR c.current_assignee_id = ANY (p_assignee_ids)
        )
        AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
        AND (
          p_response IS NULL
          OR (
            CASE
              WHEN v_has_period THEN ca.response::text = p_response
              ELSE c.latest_response::text = p_response
            END
          )
        )
    );

  RETURN jsonb_build_object(
    'totalContacts', v_total,
    'assigned', v_assigned,
    'unassigned', v_unassigned,
    'completed', v_completed,
    'remaining', v_remaining,
    'coming', v_coming,
    'notComing', v_not_coming,
    'unreachable', v_unreachable,
    'switchedOff', v_switched_off,
    'wrongNumber', v_wrong_number,
    'other', v_other,
    'contactsWithNotes', v_notes,
    'activeCampaigns', v_active_campaigns,
    'totalCallAttempts', v_attempts
  );
END;
$$;

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
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
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

  WITH universe AS (
    SELECT contact_id, current_assignee_id, response
    FROM public.report_contact_universe(
      p_assignee_ids,
      p_scope_all,
      p_campaign_id,
      p_response,
      p_from,
      p_to
    )
  ),
  member_stats AS (
    SELECT
      u.current_assignee_id AS member_id,
      count(*)::bigint AS total_contacts,
      count(*) FILTER (WHERE u.response IS NOT NULL)::bigint AS completed,
      count(*) FILTER (WHERE u.response IS NULL)::bigint AS remaining,
      count(*) FILTER (WHERE u.response = 'COMING')::bigint AS coming,
      count(*) FILTER (WHERE u.response = 'NOT_COMING')::bigint AS not_coming,
      count(*) FILTER (WHERE u.response = 'UNREACHABLE')::bigint AS unreachable,
      count(*) FILTER (WHERE u.response = 'SWITCHED_OFF')::bigint AS switched_off,
      count(*) FILTER (WHERE u.response = 'WRONG_NUMBER')::bigint AS wrong_number,
      count(*) FILTER (WHERE u.response = 'OTHER')::bigint AS other
    FROM universe u
    WHERE u.current_assignee_id IS NOT NULL
    GROUP BY u.current_assignee_id
  ),
  member_attempts AS (
    SELECT
      u.current_assignee_id AS member_id,
      count(*)::bigint AS total_attempts,
      max(ca.attempted_at) AS last_attempt_at
    FROM public.call_attempts ca
    INNER JOIN universe u ON u.contact_id = ca.contact_id
    WHERE u.current_assignee_id IS NOT NULL
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to)
    GROUP BY u.current_assignee_id
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
        'totalCallAttempts', COALESCE(ma.total_attempts, 0),
        'lastAttemptAt', ma.last_attempt_at
      ) AS row,
      ms.completed
    FROM member_stats ms
    INNER JOIN public.telepastors t ON t.id = ms.member_id
    LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
    WHERE t.is_active
      AND t.role IN ('LEADER', 'TELEPASTOR')
      AND (ms.total_contacts > 0 OR COALESCE(ma.total_attempts, 0) > 0)
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
        'totalCallAttempts', sum(COALESCE(ma.total_attempts, 0)),
        'lastAttemptAt', max(ma.last_attempt_at)
      ) AS row,
      sum(ms.completed) AS completed
    FROM member_stats ms
    LEFT JOIN member_attempts ma ON ma.member_id = ms.member_id
    INNER JOIN governor_map gm ON gm.member_id = ms.member_id
    INNER JOIN public.telepastors g
      ON g.id = gm.governor_id
     AND g.role = 'GOVERNOR'
     AND g.is_active
    GROUP BY g.id, g.name, g.role
    HAVING sum(ms.total_contacts) > 0
        OR sum(COALESCE(ma.total_attempts, 0)) > 0
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

CREATE OR REPLACE FUNCTION public.get_report_recent_activity(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_has_notes boolean DEFAULT false,
  p_limit integer DEFAULT 6
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
  v_limit integer;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER', 'TELEPASTOR') THEN
    RAISE EXCEPTION 'Not authorized for recent activity';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF actor_role = 'TELEPASTOR' THEN
    IF p_scope_all
      OR p_assignee_ids IS NULL
      OR cardinality(p_assignee_ids) <> 1
      OR p_assignee_ids[1] <> actor_id
    THEN
      RAISE EXCEPTION 'Telepastors may only load their own recent activity';
    END IF;
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 6), 500));

  SELECT COALESCE(
    jsonb_agg(row_json ORDER BY attempted_at DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'id', ca.id,
        'contactName', COALESCE(c.name, 'Unknown contact'),
        'telepastorName', COALESCE(caller.name, 'Unknown'),
        'response', ca.response::text,
        'notes', ca.notes,
        'attemptedAt', ca.attempted_at,
        'campaignName', COALESCE(camp.name, 'Unknown campaign')
      ) AS row_json,
      ca.attempted_at
    FROM public.call_attempts ca
    INNER JOIN public.contacts c ON c.id = ca.contact_id
    LEFT JOIN public.telepastors caller ON caller.id = ca.telepastor_id
    LEFT JOIN public.campaigns camp ON camp.id = ca.campaign_id
    WHERE (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to)
      AND (p_campaign_id IS NULL OR ca.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR ca.response::text = p_response)
      AND (
        NOT p_has_notes
        OR (ca.notes IS NOT NULL AND length(btrim(ca.notes)) > 0)
      )
      AND (
        p_scope_all
        OR c.current_assignee_id = ANY (p_assignee_ids)
      )
    ORDER BY ca.attempted_at DESC
    LIMIT v_limit
  ) ranked;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leadership_dashboard_stats(
  uuid[],
  boolean,
  uuid,
  text,
  timestamptz,
  timestamptz
) TO authenticated;

-- Call-queue stats for the signed-in caller (replaces loading every assigned
-- contact + every attempt in Node just to count them).
CREATE OR REPLACE FUNCTION public.get_my_call_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  v_result jsonb;
BEGIN
  actor_id := public.current_telepastor_id();

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'assigned', count(*),
    'completed', count(*) FILTER (WHERE c.latest_response IS NOT NULL),
    'remaining', count(*) FILTER (WHERE c.latest_response IS NULL),
    'coming', count(*) FILTER (WHERE c.latest_response = 'COMING'),
    'notComing', count(*) FILTER (WHERE c.latest_response = 'NOT_COMING'),
    'unreachable', count(*) FILTER (WHERE c.latest_response = 'UNREACHABLE'),
    'switchedOff', count(*) FILTER (WHERE c.latest_response = 'SWITCHED_OFF'),
    'wrongNumber', count(*) FILTER (WHERE c.latest_response = 'WRONG_NUMBER'),
    'other', count(*) FILTER (WHERE c.latest_response = 'OTHER'),
    'contactsWithNotes', count(*) FILTER (
      WHERE c.latest_notes IS NOT NULL AND length(btrim(c.latest_notes)) > 0
    )
  )
  INTO v_result
  FROM public.contacts c
  WHERE c.current_assignee_id = actor_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_call_stats() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_report_team_performance(
  uuid[],
  boolean,
  uuid,
  text,
  timestamptz,
  timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_report_recent_activity(
  uuid[],
  boolean,
  uuid,
  text,
  timestamptz,
  timestamptz,
  boolean,
  integer
) TO authenticated;

NOTIFY pgrst, 'reload schema';
