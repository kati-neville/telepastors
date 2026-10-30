-- Restore date-filtered report stats to the fast report_contact_universe path.
-- Migration 00036 rewrote the period branch to a full contacts + EXISTS scan,
-- which times out / fails on large ministries when From/To filters are set.

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
  actor_org UUID;
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
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
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
    WHERE s.organization_id = actor_org
      AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id);

    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND camp.organization_id = actor_org
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
      AND EXISTS (
        SELECT 1
        FROM public.campaign_assignee_stats s
        WHERE s.campaign_id = camp.id
          AND s.organization_id = actor_org
          AND s.total_contacts > 0
          AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      );
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
    WHERE ca.organization_id = actor_org
      AND c.organization_id = actor_org
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
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

    IF p_response IS NULL THEN
      SELECT count(DISTINCT u.campaign_id)
      INTO v_active_campaigns
      FROM public.report_contact_universe(
        p_assignee_ids, p_scope_all, p_campaign_id, NULL, p_from, p_to
      ) u
      INNER JOIN public.campaigns camp ON camp.id = u.campaign_id
      WHERE camp.status = 'ACTIVE'
        AND camp.organization_id = actor_org;
    ELSE
      SELECT count(DISTINCT c.campaign_id)
      INTO v_active_campaigns
      FROM public.call_attempts ca
      INNER JOIN public.contacts c ON c.id = ca.contact_id
      INNER JOIN public.campaigns camp ON camp.id = c.campaign_id
      WHERE camp.status = 'ACTIVE'
        AND camp.organization_id = actor_org
        AND ca.organization_id = actor_org
        AND c.organization_id = actor_org
        AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
        AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
        AND (p_from IS NULL OR ca.attempted_at >= p_from)
        AND (p_to IS NULL OR ca.attempted_at <= p_to);
    END IF;
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

GRANT EXECUTE ON FUNCTION public.get_leadership_dashboard_stats(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

NOTIFY pgrst, 'reload schema';
