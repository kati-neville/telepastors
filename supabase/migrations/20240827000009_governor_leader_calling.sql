-- Allow Governors and Leaders to record call attempts for contacts assigned to them.

CREATE OR REPLACE FUNCTION public.can_record_call_attempt(target_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  contact_assignee_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  IF actor_role NOT IN ('GOVERNOR', 'LEADER', 'TELEPASTOR') THEN
    RETURN false;
  END IF;

  SELECT current_assignee_id INTO contact_assignee_id
  FROM public.contacts
  WHERE id = target_contact_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN contact_assignee_id = actor_id;
END;
$$;
