-- Allow downstream reassignment: current contact holder can end active
-- assignments even when assigned_by was an upstream role (e.g. Super Admin -> Governor -> Leader).

CREATE OR REPLACE FUNCTION public.can_end_active_assignment(target_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  target_contact_id UUID;
  assignment_assigned_by UUID;
  contact_assignee_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT contact_id, assigned_by
  INTO target_contact_id, assignment_assigned_by
  FROM public.contact_assignments
  WHERE id = target_assignment_id
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  IF assignment_assigned_by = actor_id THEN
    RETURN true;
  END IF;

  SELECT current_assignee_id
  INTO contact_assignee_id
  FROM public.contacts
  WHERE id = target_contact_id;

  RETURN contact_assignee_id = actor_id;
END;
$$;

DROP POLICY IF EXISTS contact_assignments_update_policy ON public.contact_assignments;

CREATE POLICY contact_assignments_update_policy ON public.contact_assignments
  FOR UPDATE
  TO authenticated
  USING (public.can_end_active_assignment(id))
  WITH CHECK (
    public.current_ministry_role() = 'SUPER_ADMIN'
    OR assigned_by = public.current_telepastor_id()
    OR ended_at IS NOT NULL
  );

GRANT EXECUTE ON FUNCTION public.can_end_active_assignment(UUID) TO authenticated;
