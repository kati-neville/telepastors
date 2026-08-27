-- Phase 3: Campaigns, contacts, and import history

CREATE TYPE public.campaign_status AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE public.contact_import_status AS ENUM (
  'PREVIEW',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  status public.campaign_status NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaigns_status_idx ON public.campaigns (status);
CREATE INDEX campaigns_created_by_idx ON public.campaigns (created_by);
CREATE INDEX campaigns_event_date_idx ON public.campaigns (event_date);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.contact_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX contact_imports_campaign_id_idx ON public.contact_imports (campaign_id);
CREATE INDEX contact_imports_status_idx ON public.contact_imports (status);

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  import_id UUID REFERENCES public.contact_imports(id) ON DELETE SET NULL,
  import_row_number INTEGER,
  import_metadata JSONB,
  latest_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_campaign_phone_unique UNIQUE (campaign_id, phone_normalized)
);

CREATE INDEX contacts_campaign_id_idx ON public.contacts (campaign_id);
CREATE INDEX contacts_phone_normalized_idx ON public.contacts (phone_normalized);
CREATE INDEX contacts_import_id_idx ON public.contacts (import_id);
CREATE INDEX contacts_name_lower_idx ON public.contacts (lower(name));

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_campaigns()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() IN ('SUPER_ADMIN', 'GOVERNOR');
$$;

CREATE OR REPLACE FUNCTION public.can_import_campaign_contacts()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() = 'SUPER_ADMIN';
$$;

CREATE OR REPLACE FUNCTION public.can_view_campaign(target_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_campaigns();
$$;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_select_policy ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (public.can_view_campaign(id));

CREATE POLICY campaigns_insert_policy ON public.campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_campaigns());

CREATE POLICY campaigns_update_policy ON public.campaigns
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_campaigns())
  WITH CHECK (public.can_manage_campaigns());

CREATE POLICY campaigns_delete_policy ON public.campaigns
  FOR DELETE
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

CREATE POLICY contacts_select_policy ON public.contacts
  FOR SELECT
  TO authenticated
  USING (public.can_view_campaign(campaign_id));

CREATE POLICY contacts_insert_policy ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_import_campaign_contacts()
    AND public.can_view_campaign(campaign_id)
  );

CREATE POLICY contacts_update_policy ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_campaigns() AND public.can_view_campaign(campaign_id))
  WITH CHECK (public.can_manage_campaigns() AND public.can_view_campaign(campaign_id));

CREATE POLICY contacts_delete_policy ON public.contacts
  FOR DELETE
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

CREATE POLICY contact_imports_select_policy ON public.contact_imports
  FOR SELECT
  TO authenticated
  USING (public.can_view_campaign(campaign_id));

CREATE POLICY contact_imports_insert_policy ON public.contact_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_import_campaign_contacts()
    AND public.can_view_campaign(campaign_id)
  );

CREATE POLICY contact_imports_update_policy ON public.contact_imports
  FOR UPDATE
  TO authenticated
  USING (
    public.can_import_campaign_contacts()
    AND public.can_view_campaign(campaign_id)
  )
  WITH CHECK (
    public.can_import_campaign_contacts()
    AND public.can_view_campaign(campaign_id)
  );

CREATE POLICY contact_imports_delete_policy ON public.contact_imports
  FOR DELETE
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_imports TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_import_campaign_contacts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_campaign(UUID) TO authenticated;
