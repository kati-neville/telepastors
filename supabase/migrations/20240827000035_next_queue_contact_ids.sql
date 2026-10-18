-- Cheap next-call lookup: uncalled contacts first (no call_attempts rows),
-- then remaining pending contacts with the fewest attempts.

CREATE INDEX IF NOT EXISTS contacts_assignee_pending_name_idx
  ON public.contacts (current_assignee_id, name, id)
  WHERE latest_response IS NULL;

CREATE OR REPLACE FUNCTION public.get_next_queue_contact_ids(
  p_campaign_id uuid DEFAULT NULL,
  p_skip_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 2
)
RETURNS TABLE (
  contact_id uuid,
  attempt_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  v_limit integer;
  v_skip uuid[];
  v_uncalled integer;
BEGIN
  actor_id := public.current_telepastor_id();

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 2), 10));
  v_skip := COALESCE(p_skip_ids, '{}'::uuid[]);

  RETURN QUERY
  SELECT c.id, 0
  FROM public.contacts c
  WHERE c.current_assignee_id = actor_id
    AND c.latest_response IS NULL
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND NOT (c.id = ANY (v_skip))
    AND NOT EXISTS (
      SELECT 1
      FROM public.call_attempts ca
      WHERE ca.contact_id = c.id
    )
  ORDER BY c.name ASC, c.id ASC
  LIMIT v_limit;

  GET DIAGNOSTICS v_uncalled = ROW_COUNT;

  IF v_uncalled >= v_limit THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, count(ca.id)::integer
  FROM public.contacts c
  INNER JOIN public.call_attempts ca ON ca.contact_id = c.id
  WHERE c.current_assignee_id = actor_id
    AND c.latest_response IS NULL
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND NOT (c.id = ANY (v_skip))
  GROUP BY c.id, c.name
  ORDER BY count(ca.id) ASC, c.name ASC, c.id ASC
  LIMIT (v_limit - v_uncalled);
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_queue_contact_ids(uuid, uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_queue_contact_ids(uuid, uuid[], integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
