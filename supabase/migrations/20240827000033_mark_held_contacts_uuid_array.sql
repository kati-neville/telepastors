-- Retained-contact RPC: uuid[] is accepted by PostgREST; jsonb arrays were 400ing.

DROP FUNCTION IF EXISTS public.mark_contacts_held_for_own_calls(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.mark_contacts_held_for_own_calls(
  p_campaign_id uuid,
  p_actor_id uuid,
  p_contact_ids uuid[]
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

  IF p_contact_ids IS NULL THEN
    RETURN jsonb_build_object('updatedCount', 0);
  END IF;

  SELECT count(DISTINCT id)::integer
  INTO v_wanted
  FROM unnest(p_contact_ids) AS id;

  IF v_wanted = 0 THEN
    RETURN jsonb_build_object('updatedCount', 0);
  END IF;

  UPDATE public.contacts c
  SET held_for_own_calls = true
  WHERE c.campaign_id = p_campaign_id
    AND c.current_assignee_id = p_actor_id
    AND c.id = ANY (p_contact_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_wanted THEN
    RAISE EXCEPTION
      'You can only keep contacts currently assigned to you in this campaign.';
  END IF;

  RETURN jsonb_build_object('updatedCount', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_contacts_held_for_own_calls(uuid, uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_contacts_held_for_own_calls(uuid, uuid, uuid[])
  TO authenticated;

NOTIFY pgrst, 'reload schema';
