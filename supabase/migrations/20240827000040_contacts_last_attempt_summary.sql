-- Date-filtered reports need denormalized attempt summary on contacts.
-- report_contact_universe (00029/00036) reads last_attempt_* / attempt_count,
-- but those columns were never added — so From/To filters fail with
-- "column contacts.last_attempt_at does not exist".

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_response public.call_response,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS contacts_assignee_last_attempt_idx
  ON public.contacts (current_assignee_id, last_attempt_at)
  WHERE last_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_organization_last_attempt_idx
  ON public.contacts (organization_id, last_attempt_at)
  WHERE last_attempt_at IS NOT NULL;

-- Backfill from call_attempts
UPDATE public.contacts c
SET
  attempt_count = summary.attempt_count,
  last_attempt_at = summary.last_attempt_at,
  last_attempt_response = summary.last_attempt_response
FROM (
  SELECT
    ca.contact_id,
    count(*)::integer AS attempt_count,
    max(ca.attempted_at) AS last_attempt_at,
    (
      ARRAY_AGG(ca.response ORDER BY ca.attempted_at DESC, ca.id DESC)
    )[1] AS last_attempt_response
  FROM public.call_attempts ca
  GROUP BY ca.contact_id
) summary
WHERE c.id = summary.contact_id;

CREATE OR REPLACE FUNCTION public.sync_contact_last_attempt_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_count integer;
  v_last_at timestamptz;
  v_response public.call_response;
BEGIN
  v_contact_id := COALESCE(NEW.contact_id, OLD.contact_id);

  IF v_contact_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    count(*)::integer,
    max(ca.attempted_at),
    (
      ARRAY_AGG(ca.response ORDER BY ca.attempted_at DESC, ca.id DESC)
    )[1]
  INTO v_count, v_last_at, v_response
  FROM public.call_attempts ca
  WHERE ca.contact_id = v_contact_id;

  UPDATE public.contacts
  SET
    attempt_count = COALESCE(v_count, 0),
    last_attempt_at = v_last_at,
    last_attempt_response = v_response
  WHERE id = v_contact_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_last_attempt_summary ON public.call_attempts;
CREATE TRIGGER trg_contacts_last_attempt_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.call_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contact_last_attempt_summary();

NOTIFY pgrst, 'reload schema';
