-- Undo distribution: extend job status + reclaim RPC

ALTER TABLE public.distribution_jobs
  DROP CONSTRAINT IF EXISTS distribution_jobs_status_check;

ALTER TABLE public.distribution_jobs
  ADD CONSTRAINT distribution_jobs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'undone'));

ALTER TABLE public.distribution_jobs
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS undo_result JSONB;

-- Reclaim contacts from a distribution back to the actor (or unassign for SA).
-- p_mode: 'reclaim' | 'unassign'
-- p_items: [{ "contact_id": uuid, "expected_assignee_id": uuid }, ...]
CREATE OR REPLACE FUNCTION public.undo_distribution_reclaim_contacts(
  p_campaign_id UUID,
  p_actor_id UUID,
  p_mode TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_contact_id UUID;
  v_expected_assignee_id UUID;
  v_old_assignment_id UUID;
  v_new_assignment_id UUID;
  v_current_assignee_id UUID;
  v_assigned_by UUID;
  v_actor_role public.ministry_role;
  v_prior_assigned_by UUID;
  v_ended_rows INT;
  v_reclaimed INT := 0;
  v_blocked INT := 0;
  v_blocked_reasons JSONB := '[]'::jsonb;
BEGIN
  IF p_actor_id IS DISTINCT FROM public.current_telepastor_id() THEN
    RAISE EXCEPTION 'Unauthorized undo request';
  END IF;

  IF p_mode NOT IN ('reclaim', 'unassign') THEN
    RAISE EXCEPTION 'Invalid undo mode';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Items payload must be a JSON array';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.telepastors
  WHERE id = p_actor_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actor not found or inactive';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_contact_id := (item->>'contact_id')::UUID;
    v_expected_assignee_id := (item->>'expected_assignee_id')::UUID;

    IF NOT public.can_view_contact(v_contact_id) THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'not_visible'
        )
      );
      CONTINUE;
    END IF;

    SELECT current_assignee_id, current_assignment_id
    INTO v_current_assignee_id, v_old_assignment_id
    FROM public.contacts
    WHERE id = v_contact_id
      AND campaign_id = p_campaign_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'not_found'
        )
      );
      CONTINUE;
    END IF;

    IF v_current_assignee_id IS DISTINCT FROM v_expected_assignee_id THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'redistributed'
        )
      );
      CONTINUE;
    END IF;

    IF v_old_assignment_id IS NULL THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'no_assignment'
        )
      );
      CONTINUE;
    END IF;

    SELECT assigned_by INTO v_assigned_by
    FROM public.contact_assignments
    WHERE id = v_old_assignment_id;

    IF v_assigned_by IS DISTINCT FROM p_actor_id THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'not_from_this_actor'
        )
      );
      CONTINUE;
    END IF;

    UPDATE public.contact_assignments
    SET ended_at = now()
    WHERE id = v_old_assignment_id
      AND ended_at IS NULL;

    GET DIAGNOSTICS v_ended_rows = ROW_COUNT;

    IF v_ended_rows = 0 THEN
      v_blocked := v_blocked + 1;
      v_blocked_reasons := v_blocked_reasons || jsonb_build_array(
        jsonb_build_object(
          'contactId', v_contact_id,
          'reason', 'end_assignment_failed'
        )
      );
      CONTINUE;
    END IF;

    IF p_mode = 'unassign' THEN
      UPDATE public.contacts
      SET
        assignment_status = 'UNASSIGNED',
        current_assignee_id = NULL,
        current_assignment_id = NULL,
        held_for_own_calls = false,
        latest_response = NULL
      WHERE id = v_contact_id;

      v_reclaimed := v_reclaimed + 1;
      CONTINUE;
    END IF;

    -- reclaim to actor: restore prior assigned_by when possible so pool readiness works
    SELECT assigned_by
    INTO v_prior_assigned_by
    FROM public.contact_assignments
    WHERE contact_id = v_contact_id
      AND assignee_id = p_actor_id
      AND ended_at IS NOT NULL
      AND id IS DISTINCT FROM v_old_assignment_id
    ORDER BY ended_at DESC
    LIMIT 1;

    INSERT INTO public.contact_assignments (
      contact_id,
      campaign_id,
      assignee_id,
      assigned_by,
      assignee_role,
      status,
      notes
    )
    VALUES (
      v_contact_id,
      p_campaign_id,
      p_actor_id,
      v_prior_assigned_by,
      v_actor_role,
      'ASSIGNED',
      '__undone_distribution_reclaim__'
    )
    RETURNING id INTO v_new_assignment_id;

    UPDATE public.contact_assignments
    SET superseded_by = v_new_assignment_id
    WHERE id = v_old_assignment_id;

    UPDATE public.contacts
    SET
      assignment_status = 'ASSIGNED',
      current_assignee_id = p_actor_id,
      current_assignment_id = v_new_assignment_id,
      held_for_own_calls = false,
      latest_response = NULL
    WHERE id = v_contact_id;

    v_reclaimed := v_reclaimed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'reclaimedCount', v_reclaimed,
    'blockedCount', v_blocked,
    'blocked', v_blocked_reasons
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_distribution_reclaim_contacts(
  UUID,
  UUID,
  TEXT,
  JSONB
) TO authenticated;
