-- Phase: Telepastor bulk Excel import history

CREATE OR REPLACE FUNCTION public.can_import_telepastors()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER');
$$;

CREATE TABLE public.telepastor_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  status public.contact_import_status NOT NULL DEFAULT 'PREVIEW',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  column_mapping JSONB,
  preview_data JSONB,
  error_summary JSONB,
  credentials_export JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX telepastor_imports_imported_by_idx ON public.telepastor_imports (imported_by);
CREATE INDEX telepastor_imports_status_idx ON public.telepastor_imports (status);
CREATE INDEX telepastor_imports_created_at_idx ON public.telepastor_imports (created_at DESC);

ALTER TABLE public.telepastor_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY telepastor_imports_select_policy ON public.telepastor_imports
  FOR SELECT
  TO authenticated
  USING (
    public.current_ministry_role() = 'SUPER_ADMIN'
    OR imported_by = public.current_telepastor_id()
  );

CREATE POLICY telepastor_imports_insert_policy ON public.telepastor_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_import_telepastors()
    AND imported_by = public.current_telepastor_id()
  );

CREATE POLICY telepastor_imports_update_policy ON public.telepastor_imports
  FOR UPDATE
  TO authenticated
  USING (
    public.can_import_telepastors()
    AND (
      public.current_ministry_role() = 'SUPER_ADMIN'
      OR imported_by = public.current_telepastor_id()
    )
  )
  WITH CHECK (
    public.can_import_telepastors()
    AND (
      public.current_ministry_role() = 'SUPER_ADMIN'
      OR imported_by = public.current_telepastor_id()
    )
  );

CREATE POLICY telepastor_imports_delete_policy ON public.telepastor_imports
  FOR DELETE
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telepastor_imports TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_import_telepastors() TO authenticated;
