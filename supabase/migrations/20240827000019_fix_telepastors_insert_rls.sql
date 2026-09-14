-- Bulletproof insert RLS via SECURITY DEFINER helper (avoids ambiguous "role" column).

CREATE OR REPLACE FUNCTION public.can_insert_telepastor_row(
  new_role public.ministry_role,
  new_governor_id UUID,
  new_leader_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_governor_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN new_role IN ('GOVERNOR', 'LEADER', 'TELEPASTOR');
  END IF;

  IF actor_role = 'GOVERNOR' THEN
    IF new_role NOT IN ('LEADER', 'TELEPASTOR') THEN
      RETURN false;
    END IF;
    IF new_governor_id IS DISTINCT FROM actor_id THEN
      RETURN false;
    END IF;
    IF new_role = 'TELEPASTOR' AND new_leader_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.telepastors AS leader
        WHERE leader.id = new_leader_id
          AND leader.role = 'LEADER'
          AND leader.governor_id = actor_id
      );
    END IF;
    RETURN true;
  END IF;

  IF actor_role = 'LEADER' THEN
    IF new_role <> 'TELEPASTOR' THEN
      RETURN false;
    END IF;
    IF new_leader_id IS DISTINCT FROM actor_id THEN
      RETURN false;
    END IF;

    SELECT governor_id INTO actor_governor_id
    FROM public.telepastors
    WHERE id = actor_id;

    RETURN new_governor_id IS NOT DISTINCT FROM actor_governor_id;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_insert_telepastor_row(
  public.ministry_role,
  UUID,
  UUID
) TO authenticated;

DROP POLICY IF EXISTS telepastors_insert_policy ON public.telepastors;

CREATE POLICY telepastors_insert_policy ON public.telepastors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_insert_telepastor_row(
      telepastors.role,
      telepastors.governor_id,
      telepastors.leader_id
    )
  );
