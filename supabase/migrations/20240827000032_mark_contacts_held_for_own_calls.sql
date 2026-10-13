-- Mark kept-for-my-calls contacts in one set-based update (avoids PostgREST .in() URL 400s).

CREATE OR REPLACE FUNCTION public.mark_contacts_held_for_own_calls(
  p_campaign_id uuid,
  p_actor_id uuid,
  p_contact_ids jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.ministry_role;
  v_wanted integer := 0;
  v_updated integer := 0;
BEGIN
  IF p_actor_id IS DISTINCT FROM public.current_telepastor_id() THEN
    RAISE EXCEPTION 'Unauthorized retain request';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.telepastors
  WHERE id = p_actor_id AND is_active = true;

  IF NOT FOUND OR v_actor_role NOT IN ('GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'You cannot retain contacts for your own calling.';
  END IF;

  IF p_contact_ids IS NULL OR jsonb_typeof(p_contact_ids) <> 'array' THEN
    RAISE EXCEPTION 'Contact ids payload must be a JSON array';
  END IF;

  SELECT count(DISTINCT value)::integer
  INTO v_wanted
  FROM jsonb_array_elements_text(p_contact_ids);

  IF v_wanted = 0 THEN
    RETURN jsonb_build_object('updatedCount', 0);
  END IF;

  WITH wanted AS (
    SELECT DISTINCT value::uuid AS id
    FROM jsonb_array_elements_text(p_contact_ids)
  )
  UPDATE public.contacts c
  SET held_for_own_calls = true
  FROM wanted w
  WHERE c.id = w.id
    AND c.campaign_id = p_campaign_id
    AND c.current_assignee_id = p_actor_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_wanted THEN
    RAISE EXCEPTION
      'You can only keep contacts currently assigned to you in this campaign.';
  END IF;

  RETURN jsonb_build_object('updatedCount', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_contacts_held_for_own_calls(uuid, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_contacts_held_for_own_calls(uuid, uuid, jsonb)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
