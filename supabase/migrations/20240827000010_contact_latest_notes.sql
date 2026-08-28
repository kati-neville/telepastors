-- Denormalize latest call notes on contacts for dashboards, pre-fill, and follow-up reports.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS latest_notes TEXT,
  ADD COLUMN IF NOT EXISTS latest_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_recorded_by UUID REFERENCES telepastors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contacts_latest_response_at_idx
  ON contacts (latest_response_at DESC NULLS LAST)
  WHERE latest_notes IS NOT NULL;

-- Backfill from the most recent call attempt per contact.
UPDATE contacts AS c
SET
  latest_notes = latest.notes,
  latest_response_at = latest.attempted_at,
  latest_recorded_by = latest.telepastor_id
FROM (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    notes,
    attempted_at,
    telepastor_id
  FROM call_attempts
  WHERE notes IS NOT NULL AND btrim(notes) <> ''
  ORDER BY contact_id, attempted_at DESC
) AS latest
WHERE c.id = latest.contact_id;

UPDATE contacts AS c
SET
  latest_response_at = latest.attempted_at,
  latest_recorded_by = latest.telepastor_id
FROM (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    attempted_at,
    telepastor_id
  FROM call_attempts
  ORDER BY contact_id, attempted_at DESC
) AS latest
WHERE c.id = latest.contact_id
  AND c.latest_response_at IS NULL;
