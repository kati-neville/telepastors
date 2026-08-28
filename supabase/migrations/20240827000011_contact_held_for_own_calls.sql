-- Track contacts a Governor/Leader kept for their own calling so they are
-- excluded from the downstream distribution pool and dashboard prompts.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS held_for_own_calls BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contacts_held_for_own_calls_idx
  ON public.contacts (held_for_own_calls)
  WHERE held_for_own_calls = true;
