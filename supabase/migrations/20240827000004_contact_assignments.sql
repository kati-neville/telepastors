-- Phase 4: Contact assignments with history

CREATE TYPE public.contact_assignment_status AS ENUM (
  'UNASSIGNED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED'
);

ALTER TABLE public.contacts
  ADD COLUMN assignment_status public.contact_assignment_status NOT NULL DEFAULT 'UNASSIGNED',
  ADD COLUMN current_assignee_id UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  ADD COLUMN current_assignment_id UUID;

CREATE INDEX contacts_assignment_status_idx ON public.contacts (assignment_status);
CREATE INDEX contacts_current_assignee_id_idx ON public.contacts (current_assignee_id);

CREATE TABLE public.contact_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES public.telepastors(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  assignee_role public.ministry_role NOT NULL,
  status public.contact_assignment_status NOT NULL DEFAULT 'ASSIGNED',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES public.contact_assignments(id) ON DELETE SET NULL,
  notes TEXT
);

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_current_assignment_id_fkey
  FOREIGN KEY (current_assignment_id) REFERENCES public.contact_assignments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX contact_assignments_one_active_per_contact
  ON public.contact_assignments (contact_id)
  WHERE ended_at IS NULL;

CREATE INDEX contact_assignments_campaign_id_idx ON public.contact_assignments (campaign_id);
CREATE INDEX contact_assignments_contact_id_idx ON public.contact_assignments (contact_id);
CREATE INDEX contact_assignments_assignee_id_idx ON public.contact_assignments (assignee_id);
CREATE INDEX contact_assignments_assigned_at_idx ON public.contact_assignments (assigned_at DESC);

CREATE OR REPLACE FUNCTION public.can_assign_contact_to(target_assignee_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  assignee_role public.ministry_role;
  assignee_governor_id UUID;
  assignee_leader_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, governor_id, leader_id
  INTO assignee_role, assignee_governor_id, assignee_leader_id
  FROM public.telepastors
  WHERE id = target_assignee_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN assignee_role = 'GOVERNOR';
  END IF;

  IF actor_role = 'GOVERNOR' THEN
    RETURN assignee_role = 'LEADER' AND assignee_governor_id = actor_id;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_contact(target_contact_id UUID)
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
  assignee_role public.ministry_role;
  assignee_governor_id UUID;
  assignee_leader_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT current_assignee_id INTO contact_assignee_id
  FROM public.contacts
  WHERE id = target_contact_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  IF contact_assignee_id IS NULL THEN
    RETURN false;
  END IF;

  IF contact_assignee_id = actor_id THEN
    RETURN true;
  END IF;

  SELECT role, governor_id, leader_id
  INTO assignee_role, assignee_governor_id, assignee_leader_id
  FROM public.telepastors
  WHERE id = contact_assignee_id;

  IF actor_role = 'GOVERNOR' THEN
    IF assignee_role = 'LEADER' AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    IF assignee_role = 'TELEPASTOR' AND assignee_leader_id IS NOT NULL THEN
      SELECT governor_id INTO assignee_governor_id
      FROM public.telepastors
      WHERE id = assignee_leader_id;

      RETURN assignee_governor_id = actor_id;
    END IF;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_campaign(target_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  IF actor_role IN ('SUPER_ADMIN', 'GOVERNOR') THEN
    RETURN public.can_manage_campaigns();
  END IF;

  IF actor_role IN ('LEADER', 'TELEPASTOR') THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.campaign_id = target_campaign_id
        AND public.can_view_contact(c.id)
    );
  END IF;

  RETURN false;
END;
$$;

ALTER TABLE public.contact_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_assignments_select_policy ON public.contact_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_view_contact(contact_id));

CREATE POLICY contact_assignments_insert_policy ON public.contact_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_assign_contact_to(assignee_id)
    AND public.can_view_contact(contact_id)
    AND assigned_by = public.current_telepastor_id()
  );

CREATE POLICY contact_assignments_update_policy ON public.contact_assignments
  FOR UPDATE
  TO authenticated
  USING (
    assigned_by = public.current_telepastor_id()
    OR public.current_ministry_role() = 'SUPER_ADMIN'
  )
  WITH CHECK (
    assigned_by = public.current_telepastor_id()
    OR public.current_ministry_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS contacts_select_policy ON public.contacts;
CREATE POLICY contacts_select_policy ON public.contacts
  FOR SELECT
  TO authenticated
  USING (public.can_view_contact(id));

DROP POLICY IF EXISTS contacts_update_policy ON public.contacts;
CREATE POLICY contacts_update_policy ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (public.can_view_contact(id))
  WITH CHECK (public.can_view_contact(id));

GRANT SELECT, INSERT, UPDATE ON public.contact_assignments TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_assign_contact_to(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_contact(UUID) TO authenticated;
