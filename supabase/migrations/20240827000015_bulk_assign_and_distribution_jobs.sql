-- Bulk contact assignment RPC + background distribution job tracking

CREATE TABLE public.distribution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.telepastors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  retain_count INT NOT NULL DEFAULT 0,
  pool_total INT NOT NULL DEFAULT 0,
  assigned_count INT NOT NULL DEFAULT 0,
  reassigned_count INT NOT NULL DEFAULT 0,
  progress_completed INT NOT NULL DEFAULT 0,
  progress_total INT NOT NULL DEFAULT 0,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX distribution_jobs_actor_id_idx ON public.distribution_jobs (actor_id);
CREATE INDEX distribution_jobs_campaign_id_idx ON public.distribution_jobs (campaign_id);
CREATE INDEX distribution_jobs_status_idx ON public.distribution_jobs (status);

ALTER TABLE public.distribution_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY distribution_jobs_select_policy ON public.distribution_jobs
  FOR SELECT
  TO authenticated
  USING (actor_id = public.current_telepastor_id());

CREATE POLICY distribution_jobs_insert_policy ON public.distribution_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = public.current_telepastor_id());

CREATE POLICY distribution_jobs_update_policy ON public.distribution_jobs
  FOR UPDATE
  TO authenticated
  USING (actor_id = public.current_telepastor_id())
  WITH CHECK (actor_id = public.current_telepastor_id());

GRANT SELECT, INSERT, UPDATE ON public.distribution_jobs TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_assign_contacts(
  p_campaign_id UUID,
  p_assignments JSONB,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_contact_id UUID;
  v_assignee_id UUID;
  v_old_assignment_id UUID;
  v_new_assignment_id UUID;
  v_assignee_role public.ministry_role;
  v_assigned_count INT := 0;
  v_reassigned_count INT := 0;
  v_ended_rows INT;
BEGIN
  IF p_assigned_by IS DISTINCT FROM public.current_telepastor_id() THEN
    RAISE EXCEPTION 'Unauthorized bulk assignment request';
  END IF;

  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' THEN
    RAISE EXCEPTION 'Assignments payload must be a JSON array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_contact_id := (item->>'contact_id')::UUID;
    v_assignee_id := (item->>'assignee_id')::UUID;

    IF NOT public.can_assign_contact_to(v_assignee_id) THEN
      RAISE EXCEPTION 'Cannot assign contacts to assignee %', v_assignee_id;
    END IF;

    IF NOT public.can_view_contact(v_contact_id) THEN
      RAISE EXCEPTION 'Cannot assign contact %', v_contact_id;
    END IF;

    SELECT current_assignment_id
    INTO v_old_assignment_id
    FROM public.contacts
    WHERE id = v_contact_id
      AND campaign_id = p_campaign_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contact % was not found in campaign', v_contact_id;
    END IF;

    SELECT role
    INTO v_assignee_role
    FROM public.telepastors
    WHERE id = v_assignee_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assignee % was not found or is inactive', v_assignee_id;
    END IF;

    IF v_old_assignment_id IS NOT NULL THEN
      UPDATE public.contact_assignments
      SET ended_at = now()
      WHERE id = v_old_assignment_id
        AND ended_at IS NULL;

      GET DIAGNOSTICS v_ended_rows = ROW_COUNT;

      IF v_ended_rows = 0 THEN
        RAISE EXCEPTION 'Failed to end previous assignment for contact %', v_contact_id;
      END IF;
    END IF;

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
      v_assignee_id,
      p_assigned_by,
      v_assignee_role,
      'ASSIGNED',
      p_notes
    )
    RETURNING id INTO v_new_assignment_id;

    IF v_old_assignment_id IS NOT NULL THEN
      UPDATE public.contact_assignments
      SET superseded_by = v_new_assignment_id
      WHERE id = v_old_assignment_id;
    END IF;

    UPDATE public.contacts
    SET
      assignment_status = 'ASSIGNED',
      current_assignee_id = v_assignee_id,
      current_assignment_id = v_new_assignment_id,
      latest_response = NULL,
      held_for_own_calls = false
    WHERE id = v_contact_id;

    v_assigned_count := v_assigned_count + 1;

    IF v_old_assignment_id IS NOT NULL THEN
      v_reassigned_count := v_reassigned_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'assigned_count', v_assigned_count,
    'reassigned_count', v_reassigned_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_assign_contacts(UUID, JSONB, UUID, TEXT) TO authenticated;
