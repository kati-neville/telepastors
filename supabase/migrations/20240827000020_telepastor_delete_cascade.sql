-- Allow permanently deleting telepastors who have call/assignment history.
-- Related history rows are removed with the member; org FKs remain SET NULL.

ALTER TABLE public.call_attempts
  DROP CONSTRAINT IF EXISTS call_attempts_telepastor_id_fkey;

ALTER TABLE public.call_attempts
  ADD CONSTRAINT call_attempts_telepastor_id_fkey
  FOREIGN KEY (telepastor_id)
  REFERENCES public.telepastors(id)
  ON DELETE CASCADE;

ALTER TABLE public.contact_assignments
  DROP CONSTRAINT IF EXISTS contact_assignments_assignee_id_fkey;

ALTER TABLE public.contact_assignments
  ADD CONSTRAINT contact_assignments_assignee_id_fkey
  FOREIGN KEY (assignee_id)
  REFERENCES public.telepastors(id)
  ON DELETE CASCADE;
