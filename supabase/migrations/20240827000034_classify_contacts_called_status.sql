-- Classify contacts as called vs uncalled using the same rules as undo:
-- latest_response set, or a call_attempt on the current assignment / current assignee.
-- Unassigned contacts count any attempt.

CREATE OR REPLACE FUNCTION public.classify_contacts_called_status(
  p_contact_ids uuid[]
)
RETURNS TABLE (
  contact_id uuid,
  current_assignee_id uuid,
  is_called boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS contact_id,
    c.current_assignee_id,
    (
      c.latest_response IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.call_attempts ca
        WHERE ca.contact_id = c.id
          AND (
            (
              c.current_assignment_id IS NOT NULL
              AND ca.assignment_id = c.current_assignment_id
            )
            OR (
              c.current_assignee_id IS NOT NULL
              AND ca.telepastor_id = c.current_assignee_id
            )
            OR (
              c.current_assignment_id IS NULL
              AND c.current_assignee_id IS NULL
            )
          )
      )
    ) AS is_called
  FROM public.contacts c
  WHERE c.id = ANY (COALESCE(p_contact_ids, ARRAY[]::uuid[]))
    AND public.can_view_contact(c.id);
$$;

GRANT EXECUTE ON FUNCTION public.classify_contacts_called_status(uuid[]) TO authenticated;
