-- Track accounts that must set a new password on first sign-in.

ALTER TABLE public.telepastors
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
