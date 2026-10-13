-- Per-member assigned contact counts for the Telepastors directory.
-- SECURITY DEFINER avoids per-row can_view_contact RLS on large contact tables.

CREATE OR REPLACE FUNCTION public.get_directory_assigned_contact_counts()
RETURNS TABLE (
  assignee_id uuid,
  assigned_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  actor_role public.ministry_role;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();

  IF actor_id IS NULL OR actor_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized to view directory assignment counts';
  END IF;

  RETURN QUERY
  SELECT
    c.current_assignee_id,
    count(*)::integer
  FROM public.contacts c
  WHERE c.current_assignee_id IS NOT NULL
    AND (
      actor_role = 'SUPER_ADMIN'
      OR c.current_assignee_id = actor_id
      OR (
        actor_role = 'GOVERNOR'
        AND EXISTS (
          SELECT 1
          FROM public.telepastors t
          WHERE t.id = c.current_assignee_id
            AND (t.id = actor_id OR t.governor_id = actor_id)
        )
      )
      OR (
        actor_role = 'LEADER'
        AND EXISTS (
          SELECT 1
          FROM public.telepastors t
          WHERE t.id = c.current_assignee_id
            AND (t.id = actor_id OR t.leader_id = actor_id)
        )
      )
    )
  GROUP BY c.current_assignee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_directory_assigned_contact_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_directory_assigned_contact_counts() TO authenticated;

NOTIFY pgrst, 'reload schema';
