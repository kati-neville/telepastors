-- Normalized phone for telepastor login and lookup.

ALTER TABLE public.telepastors
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS telepastors_phone_normalized_auth_unique
  ON public.telepastors (phone_normalized)
  WHERE auth_user_id IS NOT NULL AND phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS telepastors_phone_normalized_idx
  ON public.telepastors (phone_normalized);
