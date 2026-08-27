-- Phase 5: Call attempts and response tracking

CREATE TYPE public.call_response AS ENUM (
  'COMING',
  'NOT_COMING',
  'UNREACHABLE',
  'WRONG_NUMBER',
  'OTHER'
);

ALTER TABLE public.contacts
  ALTER COLUMN latest_response TYPE public.call_response
  USING (
    CASE
      WHEN latest_response IS NULL THEN NULL
      WHEN latest_response IN ('COMING', 'NOT_COMING', 'UNREACHABLE', 'WRONG_NUMBER', 'OTHER')
        THEN latest_response::public.call_response
      ELSE NULL
    END
  );

CREATE TABLE public.call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  telepastor_id UUID NOT NULL REFERENCES public.telepastors(id) ON DELETE RESTRICT,
  assignment_id UUID REFERENCES public.contact_assignments(id) ON DELETE SET NULL,
  response public.call_response NOT NULL,
  notes TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX call_attempts_contact_id_idx ON public.call_attempts (contact_id);
CREATE INDEX call_attempts_campaign_id_idx ON public.call_attempts (campaign_id);
CREATE INDEX call_attempts_telepastor_id_idx ON public.call_attempts (telepastor_id);
CREATE INDEX call_attempts_attempted_at_idx ON public.call_attempts (attempted_at DESC);

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

  IF actor_role <> 'TELEPASTOR' THEN
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

ALTER TABLE public.call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY call_attempts_select_policy ON public.call_attempts
  FOR SELECT
  TO authenticated
  USING (public.can_view_contact(contact_id));

CREATE POLICY call_attempts_insert_policy ON public.call_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    telepastor_id = public.current_telepastor_id()
    AND public.can_record_call_attempt(contact_id)
  );

GRANT SELECT, INSERT ON public.call_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_record_call_attempt(UUID) TO authenticated;
