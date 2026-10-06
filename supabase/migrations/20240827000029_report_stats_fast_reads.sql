-- Fast, exact read paths for reports (Phase B reads + Phase C period filters).
--
-- Requires 20240827000028 (campaign_assignee_stats + per-contact attempt summary).
--
-- Current pool, no response filter  -> a few rows of campaign_assignee_stats.
-- Date window ("period")            -> contacts whose latest attempt falls in
--   the window come straight from contacts.last_attempt_*; only contacts whose
--   latest attempt is AFTER the window end need a look at their attempt
--   history (one index probe each). Same results as scanning call_attempts,
--   without scanning it.
-- Anything else (e.g. response filter on the current pool) keeps the indexed
-- contacts scan.
--
-- Semantics are unchanged from migrations 26/27 (verified against them with
-- randomized data): period universe = contacts with >= 1 attempt in the window,
-- response = latest attempt in the window, attempts counted in the window.
-- Report helpers are internal: executable only by the SECURITY DEFINER
-- functions below, never directly through the API.

CREATE INDEX IF NOT EXISTS contacts_assignee_last_attempt_idx
  ON public.contacts (current_assignee_id, last_attempt_at)
  WHERE last_attempt_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Shared contact universe
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.report_contact_universe(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
);

-- attempt_count / last_attempt_at are the contact's all-time summary; callers
-- only use them when no period is set.
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
  latest_notes text,
  attempt_count integer,
  last_attempt_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF p_from IS NULL AND p_to IS NULL THEN
    -- Current pool.
    RETURN QUERY
    SELECT
      c.id,
      c.campaign_id,
      c.current_assignee_id,
      c.latest_response,
      c.latest_notes,
      c.attempt_count,
      c.last_attempt_at
    FROM public.contacts c
    WHERE (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR c.latest_response::text = p_response);
    RETURN;
  END IF;

  -- Period, part 1: latest attempt is inside the window, so the contact's
  -- stored summary already describes "latest attempt in window".
  RETURN QUERY
  SELECT
    c.id,
    c.campaign_id,
    c.current_assignee_id,
    c.last_attempt_response,
    c.latest_notes,
    c.attempt_count,
    c.last_attempt_at
  FROM public.contacts c
  WHERE c.last_attempt_at IS NOT NULL
    AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND (p_from IS NULL OR c.last_attempt_at >= p_from)
    AND (p_to IS NULL OR c.last_attempt_at <= p_to)
    AND (p_response IS NULL OR c.last_attempt_response::text = p_response);

  -- Period, part 2: the contact was called again after the window ended, so
  -- its in-window answer has to come from its attempt history.
  IF p_to IS NOT NULL THEN
    RETURN QUERY
    SELECT
      c.id,
      c.campaign_id,
      c.current_assignee_id,
      latest.response,
      c.latest_notes,
      c.attempt_count,
      c.last_attempt_at
    FROM public.contacts c
    CROSS JOIN LATERAL (
      SELECT ca.response
      FROM public.call_attempts ca
      WHERE ca.contact_id = c.id
        AND ca.attempted_at <= p_to
        AND (p_from IS NULL OR ca.attempted_at >= p_from)
      ORDER BY ca.attempted_at DESC
      LIMIT 1
    ) latest
    WHERE c.last_attempt_at > p_to
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR latest.response::text = p_response);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_contact_universe(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Per-member counters (team performance)
-- ---------------------------------------------------------------------------

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
  v_has_period boolean := p_from IS NOT NULL OR p_to IS NOT NULL;
BEGIN
  IF NOT v_has_period AND p_response IS NULL THEN
    -- Counter table: one row per (campaign, assignee).
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
    WHERE s.assignee_id <> '00000000-0000-0000-0000-000000000000'::uuid
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
    -- Only evaluated when a period is set: attempts inside the window.
    SELECT
      u.current_assignee_id AS mid,
      count(*)::bigint AS window_attempts,
      max(ca.attempted_at) AS window_last
    FROM public.call_attempts ca
    INNER JOIN u ON u.contact_id = ca.contact_id
    WHERE v_has_period
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

-- ---------------------------------------------------------------------------
-- Headline stats
-- ---------------------------------------------------------------------------

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
  v_from_counters boolean := false;
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
  v_from_counters := NOT v_has_period AND p_response IS NULL;

  IF v_from_counters THEN
    SELECT
      COALESCE(sum(s.total_contacts), 0)::bigint,
      COALESCE(sum(s.total_contacts) FILTER (
        WHERE s.assignee_id <> '00000000-0000-0000-0000-000000000000'::uuid
      ), 0)::bigint,
      COALESCE(sum(s.total_contacts) FILTER (
        WHERE s.assignee_id = '00000000-0000-0000-0000-000000000000'::uuid
      ), 0)::bigint,
      COALESCE(sum(s.completed), 0)::bigint,
      COALESCE(sum(s.remaining), 0)::bigint,
      COALESCE(sum(s.coming), 0)::bigint,
      COALESCE(sum(s.not_coming), 0)::bigint,
      COALESCE(sum(s.unreachable), 0)::bigint,
      COALESCE(sum(s.switched_off), 0)::bigint,
      COALESCE(sum(s.wrong_number), 0)::bigint,
      COALESCE(sum(s.other), 0)::bigint,
      COALESCE(sum(s.with_notes), 0)::bigint,
      COALESCE(sum(s.total_attempts), 0)::bigint
    INTO
      v_total, v_assigned, v_unassigned, v_completed, v_remaining,
      v_coming, v_not_coming, v_unreachable, v_switched_off,
      v_wrong_number, v_other, v_notes, v_attempts
    FROM public.campaign_assignee_stats s
    WHERE (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id);
  ELSE
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
      v_total, v_assigned, v_unassigned, v_completed, v_remaining,
      v_coming, v_not_coming, v_unreachable, v_switched_off,
      v_wrong_number, v_other, v_notes
    FROM public.report_contact_universe(
      p_assignee_ids, p_scope_all, p_campaign_id, p_response, p_from, p_to
    ) u;

    SELECT count(*)
    INTO v_attempts
    FROM public.call_attempts ca
    INNER JOIN public.contacts c ON c.id = ca.contact_id
    WHERE (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to)
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (
        p_response IS NULL
        OR (
          CASE
            WHEN v_has_period THEN ca.response::text = p_response
            ELSE c.latest_response::text = p_response
          END
        )
      );
  END IF;

  IF p_scope_all AND NOT v_has_period THEN
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id);
  ELSIF NOT v_has_period THEN
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
      AND EXISTS (
        SELECT 1
        FROM public.campaign_assignee_stats s
        WHERE s.campaign_id = camp.id
          AND s.assignee_id = ANY (p_assignee_ids)
          AND s.total_contacts > 0
      );
  ELSIF p_response IS NULL THEN
    -- Campaigns of contacts that had an attempt in the window == campaigns of
    -- the (unfiltered) period universe.
    SELECT count(DISTINCT u.campaign_id)
    INTO v_active_campaigns
    FROM public.report_contact_universe(
      p_assignee_ids, p_scope_all, p_campaign_id, NULL, p_from, p_to
    ) u
    INNER JOIN public.campaigns camp ON camp.id = u.campaign_id
    WHERE camp.status = 'ACTIVE';
  ELSE
    -- Response filter: "active campaigns" still means any attempt in the window.
    SELECT count(DISTINCT c.campaign_id)
    INTO v_active_campaigns
    FROM public.call_attempts ca
    INNER JOIN public.contacts c ON c.id = ca.contact_id
    INNER JOIN public.campaigns camp ON camp.id = c.campaign_id
    WHERE camp.status = 'ACTIVE'
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to);
  END IF;

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

-- ---------------------------------------------------------------------------
-- Team performance
-- ---------------------------------------------------------------------------

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
    WHERE t.is_active
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

-- ---------------------------------------------------------------------------
-- Call-queue stats for the signed-in caller
-- ---------------------------------------------------------------------------

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
  WHERE s.assignee_id = actor_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leadership_dashboard_stats(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_report_team_performance(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_call_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
