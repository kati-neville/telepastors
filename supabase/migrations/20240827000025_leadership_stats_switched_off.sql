-- Count SWITCHED_OFF in leadership dashboard aggregates.

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

  SELECT
    count(*),
    count(*) FILTER (WHERE c.current_assignee_id IS NOT NULL),
    count(*) FILTER (WHERE c.current_assignee_id IS NULL),
    count(*) FILTER (WHERE c.latest_response IS NOT NULL),
    count(*) FILTER (WHERE c.latest_response IS NULL),
    count(*) FILTER (WHERE c.latest_response = 'COMING'),
    count(*) FILTER (WHERE c.latest_response = 'NOT_COMING'),
    count(*) FILTER (WHERE c.latest_response = 'UNREACHABLE'),
    count(*) FILTER (WHERE c.latest_response = 'SWITCHED_OFF'),
    count(*) FILTER (WHERE c.latest_response = 'WRONG_NUMBER'),
    count(*) FILTER (WHERE c.latest_response = 'OTHER'),
    count(*) FILTER (
      WHERE c.latest_notes IS NOT NULL AND length(btrim(c.latest_notes)) > 0
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
  FROM public.contacts c
  WHERE (
      p_scope_all
      OR c.current_assignee_id = ANY (p_assignee_ids)
    )
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND (p_response IS NULL OR c.latest_response::text = p_response);

  IF p_scope_all THEN
    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id);
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
        AND (p_response IS NULL OR c.latest_response::text = p_response)
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
