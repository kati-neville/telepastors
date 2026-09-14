-- Optional Leader for Telepastors; Governor required.
-- Assignment: Governor → Leaders + leaderless Telepastors; Leader → own Telepastors only.

-- 1) Drop the old CHECK that forbids governor_id on TELEPASTOR (must happen before backfill)
ALTER TABLE public.telepastors
  DROP CONSTRAINT IF EXISTS telepastors_telepastor_no_governor;

ALTER TABLE public.telepastors
  DROP CONSTRAINT IF EXISTS telepastors_telepastor_requires_governor;

-- 2) Backfill governor_id onto Telepastors from their Leader
UPDATE public.telepastors AS tp
SET governor_id = leader.governor_id
FROM public.telepastors AS leader
WHERE tp.role = 'TELEPASTOR'
  AND tp.leader_id = leader.id
  AND leader.role = 'LEADER'
  AND (tp.governor_id IS DISTINCT FROM leader.governor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.telepastors
    WHERE role = 'TELEPASTOR'
      AND governor_id IS NULL
  ) THEN
    ALTER TABLE public.telepastors
      ADD CONSTRAINT telepastors_telepastor_requires_governor
      CHECK (role <> 'TELEPASTOR' OR governor_id IS NOT NULL);
  END IF;
END $$;

-- 3) Resolve governor: led TPs via leader (fallback to row); leaderless via row governor_id
CREATE OR REPLACE FUNCTION public.get_governor_for_telepastor(target_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.ministry_role;
  target_leader_id UUID;
  target_governor_id UUID;
  leader_governor_id UUID;
BEGIN
  SELECT role, leader_id, governor_id
  INTO target_role, target_leader_id, target_governor_id
  FROM public.telepastors
  WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF target_role = 'GOVERNOR' OR target_role = 'SUPER_ADMIN' THEN
    RETURN NULL;
  END IF;

  IF target_role = 'LEADER' THEN
    RETURN target_governor_id;
  END IF;

  IF target_role = 'TELEPASTOR' THEN
    IF target_leader_id IS NOT NULL THEN
      SELECT governor_id INTO leader_governor_id
      FROM public.telepastors
      WHERE id = target_leader_id;

      RETURN COALESCE(leader_governor_id, target_governor_id);
    END IF;

    RETURN target_governor_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 4) Keep leader/governor consistent on write
CREATE OR REPLACE FUNCTION public.enforce_telepastor_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  leader_role public.ministry_role;
  leader_governor_id UUID;
BEGIN
  IF NEW.role = 'TELEPASTOR' THEN
    IF NEW.governor_id IS NULL THEN
      RAISE EXCEPTION 'Telepastors must be assigned to a Governor.';
    END IF;

    IF NEW.leader_id IS NOT NULL THEN
      SELECT role, governor_id
      INTO leader_role, leader_governor_id
      FROM public.telepastors
      WHERE id = NEW.leader_id;

      IF NOT FOUND OR leader_role <> 'LEADER' THEN
        RAISE EXCEPTION 'Telepastor leader must be an existing Leader.';
      END IF;

      IF leader_governor_id IS DISTINCT FROM NEW.governor_id THEN
        RAISE EXCEPTION 'Telepastor Leader must belong to the same Governor.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telepastors_enforce_hierarchy ON public.telepastors;
CREATE TRIGGER telepastors_enforce_hierarchy
  BEFORE INSERT OR UPDATE OF role, leader_id, governor_id
  ON public.telepastors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_telepastor_hierarchy();

-- 5) Governor visibility includes leaderless org Telepastors
CREATE OR REPLACE FUNCTION public.can_view_telepastor(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_role public.ministry_role;
  target_role public.ministry_role;
  target_leader_id UUID;
BEGIN
  viewer_id := public.current_telepastor_id();
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;

  IF viewer_id = target_id THEN
    RETURN true;
  END IF;

  viewer_role := public.current_ministry_role();
  IF viewer_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  SELECT role, leader_id
  INTO target_role, target_leader_id
  FROM public.telepastors
  WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF viewer_role = 'GOVERNOR' THEN
    IF target_role = 'LEADER' THEN
      RETURN public.get_governor_for_telepastor(target_id) = viewer_id;
    END IF;

    IF target_role = 'TELEPASTOR' THEN
      RETURN public.get_governor_for_telepastor(target_id) = viewer_id;
    END IF;
  END IF;

  IF viewer_role = 'LEADER' THEN
    IF target_role = 'TELEPASTOR' AND target_leader_id = viewer_id THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- 6) Assignment eligibility
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
    IF assignee_role = 'LEADER' AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    -- Leaderless Telepastors in this governor's org only
    IF assignee_role = 'TELEPASTOR'
      AND assignee_leader_id IS NULL
      AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;

-- 7) Contact visibility for governors includes leaderless TP assignees
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

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF actor_role = 'GOVERNOR' THEN
    IF assignee_role = 'LEADER' AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    IF assignee_role = 'TELEPASTOR' THEN
      RETURN public.get_governor_for_telepastor(contact_assignee_id) = actor_id;
    END IF;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;
