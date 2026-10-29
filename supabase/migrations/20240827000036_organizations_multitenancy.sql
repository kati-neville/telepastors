-- Multi-tenancy: organizations as the tenant boundary.
-- Existing data is backfilled into organization "First Love".
-- SUPER_ADMIN scope_all becomes "all within current organization".

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_lower_uidx
  ON public.organizations (lower(trim(name)));

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Seed current ministry and stamp tenant columns
-- ---------------------------------------------------------------------------

INSERT INTO public.organizations (id, name)
SELECT gen_random_uuid(), 'First Love'
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations WHERE lower(trim(name)) = lower('First Love')
);

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE lower(trim(name)) = lower('First Love')
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve First Love organization for backfill';
  END IF;

  -- telepastors
  ALTER TABLE public.telepastors
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.telepastors
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- campaigns
  ALTER TABLE public.campaigns
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.campaigns
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- contacts (denormalized for RLS / report filters)
  ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.contacts c
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE c.campaign_id = camp.id
    AND c.organization_id IS NULL;

  UPDATE public.contacts
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- contact_imports
  ALTER TABLE public.contact_imports
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.contact_imports ci
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE ci.campaign_id = camp.id
    AND ci.organization_id IS NULL;

  UPDATE public.contact_imports
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- contact_assignments
  ALTER TABLE public.contact_assignments
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.contact_assignments ca
  SET organization_id = c.organization_id
  FROM public.contacts c
  WHERE ca.contact_id = c.id
    AND ca.organization_id IS NULL;

  UPDATE public.contact_assignments
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- call_attempts
  ALTER TABLE public.call_attempts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.call_attempts ca
  SET organization_id = c.organization_id
  FROM public.contacts c
  WHERE ca.contact_id = c.id
    AND ca.organization_id IS NULL;

  UPDATE public.call_attempts
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- distribution_jobs
  ALTER TABLE public.distribution_jobs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.distribution_jobs dj
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE dj.campaign_id = camp.id
    AND dj.organization_id IS NULL;

  UPDATE public.distribution_jobs
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- telepastor_imports
  ALTER TABLE public.telepastor_imports
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.telepastor_imports
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- whatsapp templates
  ALTER TABLE public.whatsapp_message_templates
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.whatsapp_message_templates
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- sms broadcasts
  ALTER TABLE public.sms_broadcasts
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.sms_broadcasts
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- audit_logs
  ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.audit_logs al
  SET organization_id = t.organization_id
  FROM public.telepastors t
  WHERE al.actor_id = t.id
    AND al.organization_id IS NULL;

  UPDATE public.audit_logs
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  -- report counter tables
  ALTER TABLE public.campaign_assignee_stats
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.campaign_assignee_stats s
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE s.campaign_id = camp.id
    AND s.organization_id IS NULL;

  UPDATE public.campaign_assignee_stats
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  ALTER TABLE public.campaign_assignee_stats_daily
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.campaign_assignee_stats_daily s
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE s.campaign_id = camp.id
    AND s.organization_id IS NULL;

  UPDATE public.campaign_assignee_stats_daily
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  ALTER TABLE public.contact_call_days
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

  UPDATE public.contact_call_days d
  SET organization_id = camp.organization_id
  FROM public.campaigns camp
  WHERE d.campaign_id = camp.id
    AND d.organization_id IS NULL;

  UPDATE public.contact_call_days
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;
END;
$$;

-- Enforce NOT NULL
ALTER TABLE public.telepastors
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaigns
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contacts
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contact_imports
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contact_assignments
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.call_attempts
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.distribution_jobs
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.telepastor_imports
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.whatsapp_message_templates
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.sms_broadcasts
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaign_assignee_stats
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaign_assignee_stats_daily
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contact_call_days
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS telepastors_organization_id_idx
  ON public.telepastors (organization_id);
CREATE INDEX IF NOT EXISTS campaigns_organization_id_idx
  ON public.campaigns (organization_id);
CREATE INDEX IF NOT EXISTS contacts_organization_id_idx
  ON public.contacts (organization_id);
CREATE INDEX IF NOT EXISTS call_attempts_organization_id_idx
  ON public.call_attempts (organization_id);
CREATE INDEX IF NOT EXISTS campaign_assignee_stats_organization_id_idx
  ON public.campaign_assignee_stats (organization_id);
CREATE INDEX IF NOT EXISTS whatsapp_templates_organization_id_idx
  ON public.whatsapp_message_templates (organization_id);

-- WhatsApp slug unique per org
ALTER TABLE public.whatsapp_message_templates
  DROP CONSTRAINT IF EXISTS whatsapp_message_templates_slug_key;
DROP INDEX IF EXISTS whatsapp_message_templates_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_message_templates_org_slug_uidx
  ON public.whatsapp_message_templates (organization_id, slug);

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.telepastors
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.same_organization(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_organization_id IS NOT NULL
    AND public.current_organization_id() IS NOT NULL
    AND target_organization_id = public.current_organization_id();
$$;

-- Seed default WhatsApp templates for a new organization
CREATE OR REPLACE FUNCTION public.seed_organization_whatsapp_templates(p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_message_templates (
    organization_id, name, slug, body, is_default, is_active
  )
  VALUES
    (
      p_organization_id,
      'Event invite',
      'event-invite',
      'Hello {name}, you are invited to {campaign}. We would love to see you there!',
      true,
      true
    ),
    (
      p_organization_id,
      'General check-in',
      'general-check-in',
      'Hello {name}, we are checking in. How are you doing today?',
      false,
      true
    ),
    (
      p_organization_id,
      'Follow-up',
      'follow-up',
      'Hello {name}, thank you for speaking with us about {campaign}. We wanted to follow up with you.',
      false,
      true
    ),
    (
      p_organization_id,
      'New convert check-in',
      'new-convert-check-in',
      'Hello {name}, welcome! We are glad to connect with you and wanted to check in personally.',
      false,
      true
    )
  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_with_defaults(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.organizations (name)
  VALUES (v_name)
  RETURNING id INTO v_id;

  PERFORM public.seed_organization_whatsapp_templates(v_id);
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permission helpers: org-scoped Super Admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_telepastor(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_role public.ministry_role;
  viewer_org UUID;
  target_role public.ministry_role;
  target_leader_id UUID;
  target_org UUID;
BEGIN
  viewer_id := public.current_telepastor_id();
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;

  IF viewer_id = target_id THEN
    RETURN true;
  END IF;

  viewer_role := public.current_ministry_role();
  viewer_org := public.current_organization_id();

  SELECT role, leader_id, organization_id
  INTO target_role, target_leader_id, target_org
  FROM public.telepastors
  WHERE id = target_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF viewer_org IS NULL OR target_org IS NULL OR viewer_org <> target_org THEN
    RETURN false;
  END IF;

  IF viewer_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  IF viewer_role = 'GOVERNOR' THEN
    IF target_role = 'LEADER' THEN
      RETURN public.get_governor_for_telepastor(target_id) = viewer_id;
    END IF;

    IF target_role = 'TELEPASTOR' THEN
      RETURN public.get_governor_for_telepastor(target_id) = viewer_id;
    END IF;
  END IF;

  IF viewer_role = 'LEADER' THEN
    IF target_role = 'TELEPASTOR' AND target_leader_id = viewer_id THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_telepastor(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_role public.ministry_role;
BEGIN
  viewer_id := public.current_telepastor_id();
  IF viewer_id IS NULL OR viewer_id = target_id THEN
    RETURN false;
  END IF;

  viewer_role := public.current_ministry_role();

  IF viewer_role = 'SUPER_ADMIN' THEN
    RETURN public.can_view_telepastor(target_id);
  END IF;

  RETURN public.can_view_telepastor(target_id)
    AND viewer_role IN ('GOVERNOR', 'LEADER');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_assign_contact_to(target_assignee_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_org UUID;
  assignee_role public.ministry_role;
  assignee_governor_id UUID;
  assignee_leader_id UUID;
  assignee_org UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, governor_id, leader_id, organization_id
  INTO assignee_role, assignee_governor_id, assignee_leader_id, assignee_org
  FROM public.telepastors
  WHERE id = target_assignee_id AND is_active = true;

  IF NOT FOUND OR assignee_org IS DISTINCT FROM actor_org THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN assignee_role = 'GOVERNOR';
  END IF;

  IF actor_role = 'GOVERNOR' THEN
    IF assignee_role = 'LEADER' AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    IF assignee_role = 'TELEPASTOR'
      AND assignee_leader_id IS NULL
      AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_campaign(target_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_manage_campaigns()
    AND EXISTS (
      SELECT 1
      FROM public.campaigns camp
      WHERE camp.id = target_campaign_id
        AND camp.organization_id = public.current_organization_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_contact(target_contact_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_org UUID;
  contact_assignee_id UUID;
  contact_org UUID;
  assignee_role public.ministry_role;
  assignee_governor_id UUID;
  assignee_leader_id UUID;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RETURN false;
  END IF;

  SELECT current_assignee_id, organization_id
  INTO contact_assignee_id, contact_org
  FROM public.contacts
  WHERE id = target_contact_id;

  IF NOT FOUND OR contact_org IS DISTINCT FROM actor_org THEN
    RETURN false;
  END IF;

  IF actor_role = 'SUPER_ADMIN' THEN
    RETURN true;
  END IF;

  IF contact_assignee_id IS NULL THEN
    RETURN false;
  END IF;

  IF contact_assignee_id = actor_id THEN
    RETURN true;
  END IF;

  SELECT role, governor_id, leader_id
  INTO assignee_role, assignee_governor_id, assignee_leader_id
  FROM public.telepastors
  WHERE id = contact_assignee_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF actor_role = 'GOVERNOR' THEN
    IF assignee_role = 'LEADER' AND assignee_governor_id = actor_id THEN
      RETURN true;
    END IF;

    IF assignee_role = 'TELEPASTOR' THEN
      RETURN public.get_governor_for_telepastor(contact_assignee_id) = actor_id;
    END IF;
  END IF;

  IF actor_role = 'LEADER' THEN
    RETURN assignee_role = 'TELEPASTOR' AND assignee_leader_id = actor_id;
  END IF;

  RETURN false;
END;
$$;

-- Telepastor delete: Super Admin, same org only
DROP POLICY IF EXISTS telepastors_delete_policy ON public.telepastors;
CREATE POLICY telepastors_delete_policy ON public.telepastors
  FOR DELETE
  TO authenticated
  USING (
    public.current_ministry_role() = 'SUPER_ADMIN'
    AND organization_id = public.current_organization_id()
  );

-- Insert must stamp/caller's org
DROP POLICY IF EXISTS telepastors_insert_policy ON public.telepastors;
CREATE POLICY telepastors_insert_policy ON public.telepastors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.current_ministry_role() = 'SUPER_ADMIN'
      OR (
        public.current_ministry_role() = 'GOVERNOR'
        AND role IN ('LEADER', 'TELEPASTOR')
      )
      OR (
        public.current_ministry_role() = 'LEADER'
        AND role = 'TELEPASTOR'
      )
    )
  );

-- Organizations: members can read their own org
DROP POLICY IF EXISTS organizations_select_policy ON public.organizations;
CREATE POLICY organizations_select_policy ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = public.current_organization_id());

-- WhatsApp templates: org scoped
DROP POLICY IF EXISTS whatsapp_templates_select_policy ON public.whatsapp_message_templates;
CREATE POLICY whatsapp_templates_select_policy ON public.whatsapp_message_templates
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (is_active = true OR public.can_manage_whatsapp_templates())
  );

DROP POLICY IF EXISTS whatsapp_templates_insert_policy ON public.whatsapp_message_templates;
CREATE POLICY whatsapp_templates_insert_policy ON public.whatsapp_message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.can_manage_whatsapp_templates()
  );

DROP POLICY IF EXISTS whatsapp_templates_update_policy ON public.whatsapp_message_templates;
CREATE POLICY whatsapp_templates_update_policy ON public.whatsapp_message_templates
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.can_manage_whatsapp_templates()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.can_manage_whatsapp_templates()
  );

-- SMS broadcasts: Super Admin of current org only
DROP POLICY IF EXISTS sms_broadcasts_select_policy ON public.sms_broadcasts;
CREATE POLICY sms_broadcasts_select_policy ON public.sms_broadcasts
  FOR SELECT
  TO authenticated
  USING (
    public.can_send_sms_broadcasts()
    AND organization_id = public.current_organization_id()
  );

DROP POLICY IF EXISTS sms_broadcasts_insert_policy ON public.sms_broadcasts;
CREATE POLICY sms_broadcasts_insert_policy ON public.sms_broadcasts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_send_sms_broadcasts()
    AND created_by = public.current_telepastor_id()
    AND organization_id = public.current_organization_id()
  );

DROP POLICY IF EXISTS sms_broadcasts_update_policy ON public.sms_broadcasts;
CREATE POLICY sms_broadcasts_update_policy ON public.sms_broadcasts
  FOR UPDATE
  TO authenticated
  USING (
    public.can_send_sms_broadcasts()
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    public.can_send_sms_broadcasts()
    AND organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- Keep report counter writes org-aware
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_campaign_assignee_delta(
  p_campaign_id uuid,
  p_assignee_id uuid,
  p_total_contacts integer,
  p_completed integer,
  p_remaining integer,
  p_coming integer,
  p_not_coming integer,
  p_unreachable integer,
  p_switched_off integer,
  p_wrong_number integer,
  p_other integer,
  p_with_notes integer,
  p_total_attempts integer,
  p_last_attempt_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_assignee_stats (
    campaign_id,
    assignee_id,
    organization_id,
    total_contacts,
    completed,
    remaining,
    coming,
    not_coming,
    unreachable,
    switched_off,
    wrong_number,
    other,
    with_notes,
    total_attempts,
    last_attempt_at
  )
  VALUES (
    p_campaign_id,
    p_assignee_id,
    v_org,
    p_total_contacts,
    p_completed,
    p_remaining,
    p_coming,
    p_not_coming,
    p_unreachable,
    p_switched_off,
    p_wrong_number,
    p_other,
    p_with_notes,
    p_total_attempts,
    p_last_attempt_at
  )
  ON CONFLICT (campaign_id, assignee_key) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    total_contacts = public.campaign_assignee_stats.total_contacts + EXCLUDED.total_contacts,
    completed = public.campaign_assignee_stats.completed + EXCLUDED.completed,
    remaining = public.campaign_assignee_stats.remaining + EXCLUDED.remaining,
    coming = public.campaign_assignee_stats.coming + EXCLUDED.coming,
    not_coming = public.campaign_assignee_stats.not_coming + EXCLUDED.not_coming,
    unreachable = public.campaign_assignee_stats.unreachable + EXCLUDED.unreachable,
    switched_off = public.campaign_assignee_stats.switched_off + EXCLUDED.switched_off,
    wrong_number = public.campaign_assignee_stats.wrong_number + EXCLUDED.wrong_number,
    other = public.campaign_assignee_stats.other + EXCLUDED.other,
    with_notes = public.campaign_assignee_stats.with_notes + EXCLUDED.with_notes,
    total_attempts = public.campaign_assignee_stats.total_attempts + EXCLUDED.total_attempts,
    last_attempt_at = CASE
      WHEN public.campaign_assignee_stats.total_attempts + EXCLUDED.total_attempts <= 0 THEN NULL
      WHEN EXCLUDED.last_attempt_at IS NOT NULL THEN
        GREATEST(public.campaign_assignee_stats.last_attempt_at, EXCLUDED.last_attempt_at)
      ELSE public.campaign_assignee_stats.last_attempt_at
    END;
END;
$$;

-- ---------------------------------------------------------------------------
-- Report / directory RPCs: scope_all = current organization
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_directory_assigned_contact_counts()
RETURNS TABLE (
  assignee_id uuid,
  assigned_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  actor_role public.ministry_role;
  actor_org uuid;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized to view directory assignment counts';
  END IF;

  RETURN QUERY
  SELECT
    c.current_assignee_id,
    count(*)::integer
  FROM public.contacts c
  WHERE c.current_assignee_id IS NOT NULL
    AND c.organization_id = actor_org
    AND (
      actor_role = 'SUPER_ADMIN'
      OR c.current_assignee_id = actor_id
      OR (
        actor_role = 'GOVERNOR'
        AND EXISTS (
          SELECT 1
          FROM public.telepastors t
          WHERE t.id = c.current_assignee_id
            AND t.organization_id = actor_org
            AND (t.id = actor_id OR t.governor_id = actor_id)
        )
      )
      OR (
        actor_role = 'LEADER'
        AND EXISTS (
          SELECT 1
          FROM public.telepastors t
          WHERE t.id = c.current_assignee_id
            AND t.organization_id = actor_org
            AND (t.id = actor_id OR t.leader_id = actor_id)
        )
      )
    )
  GROUP BY c.current_assignee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leadership_dashboard_stats(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_org UUID;
  v_total bigint := 0;
  v_assigned bigint := 0;
  v_unassigned bigint := 0;
  v_completed bigint := 0;
  v_remaining bigint := 0;
  v_coming bigint := 0;
  v_not_coming bigint := 0;
  v_unreachable bigint := 0;
  v_switched_off bigint := 0;
  v_wrong_number bigint := 0;
  v_other bigint := 0;
  v_notes bigint := 0;
  v_active_campaigns bigint := 0;
  v_attempts bigint := 0;
  v_has_period boolean := false;
  v_from_counters boolean := false;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER') THEN
    RAISE EXCEPTION 'Not authorized for leadership dashboard stats';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN jsonb_build_object(
      'totalContacts', 0,
      'assigned', 0,
      'unassigned', 0,
      'completed', 0,
      'remaining', 0,
      'coming', 0,
      'notComing', 0,
      'unreachable', 0,
      'switchedOff', 0,
      'wrongNumber', 0,
      'other', 0,
      'contactsWithNotes', 0,
      'activeCampaigns', 0,
      'totalCallAttempts', 0
    );
  END IF;

  v_has_period := p_from IS NOT NULL OR p_to IS NOT NULL;
  v_from_counters := NOT v_has_period AND p_response IS NULL;

  IF v_from_counters THEN
    SELECT
      COALESCE(sum(s.total_contacts), 0)::bigint,
      COALESCE(sum(s.total_contacts) FILTER (
        WHERE s.assignee_id <> '00000000-0000-0000-0000-000000000000'::uuid
      ), 0)::bigint,
      COALESCE(sum(s.total_contacts) FILTER (
        WHERE s.assignee_id = '00000000-0000-0000-0000-000000000000'::uuid
      ), 0)::bigint,
      COALESCE(sum(s.completed), 0)::bigint,
      COALESCE(sum(s.remaining), 0)::bigint,
      COALESCE(sum(s.coming), 0)::bigint,
      COALESCE(sum(s.not_coming), 0)::bigint,
      COALESCE(sum(s.unreachable), 0)::bigint,
      COALESCE(sum(s.switched_off), 0)::bigint,
      COALESCE(sum(s.wrong_number), 0)::bigint,
      COALESCE(sum(s.other), 0)::bigint,
      COALESCE(sum(s.with_notes), 0)::bigint,
      COALESCE(sum(s.total_attempts), 0)::bigint
    INTO
      v_total, v_assigned, v_unassigned, v_completed, v_remaining,
      v_coming, v_not_coming, v_unreachable, v_switched_off,
      v_wrong_number, v_other, v_notes, v_attempts
    FROM public.campaign_assignee_stats s
    WHERE s.organization_id = actor_org
      AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR s.campaign_id = p_campaign_id);

    SELECT count(*)
    INTO v_active_campaigns
    FROM public.campaigns camp
    WHERE camp.status = 'ACTIVE'
      AND camp.organization_id = actor_org
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
      AND EXISTS (
        SELECT 1
        FROM public.campaign_assignee_stats s
        WHERE s.campaign_id = camp.id
          AND s.organization_id = actor_org
          AND s.total_contacts > 0
          AND (p_scope_all OR s.assignee_id = ANY (p_assignee_ids))
      );
  ELSE
    -- Period / response filters: fall back to contact universe scoped by org
    SELECT
      count(*)::bigint,
      count(*) FILTER (WHERE c.current_assignee_id IS NOT NULL)::bigint,
      count(*) FILTER (WHERE c.current_assignee_id IS NULL)::bigint,
      count(*) FILTER (WHERE c.latest_response IS NOT NULL)::bigint,
      count(*) FILTER (WHERE c.latest_response IS NULL)::bigint,
      count(*) FILTER (WHERE c.latest_response = 'COMING')::bigint,
      count(*) FILTER (WHERE c.latest_response = 'NOT_COMING')::bigint,
      count(*) FILTER (WHERE c.latest_response = 'UNREACHABLE')::bigint,
      count(*) FILTER (WHERE c.latest_response = 'SWITCHED_OFF')::bigint,
      count(*) FILTER (WHERE c.latest_response = 'WRONG_NUMBER')::bigint,
      count(*) FILTER (WHERE c.latest_response = 'OTHER')::bigint,
      count(*) FILTER (
        WHERE c.latest_notes IS NOT NULL AND length(trim(c.latest_notes)) > 0
      )::bigint
    INTO
      v_total, v_assigned, v_unassigned, v_completed, v_remaining,
      v_coming, v_not_coming, v_unreachable, v_switched_off,
      v_wrong_number, v_other, v_notes
    FROM public.contacts c
    WHERE c.organization_id = actor_org
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (
        p_scope_all
        OR c.current_assignee_id = ANY (p_assignee_ids)
      )
      AND (p_response IS NULL OR c.latest_response::text = p_response)
      AND (
        NOT v_has_period
        OR EXISTS (
          SELECT 1
          FROM public.call_attempts ca
          WHERE ca.contact_id = c.id
            AND ca.organization_id = actor_org
            AND (p_from IS NULL OR ca.attempted_at >= p_from)
            AND (p_to IS NULL OR ca.attempted_at <= p_to)
        )
      );

    SELECT COALESCE(count(*), 0)::bigint
    INTO v_attempts
    FROM public.call_attempts ca
    INNER JOIN public.contacts c ON c.id = ca.contact_id
    WHERE ca.organization_id = actor_org
      AND c.organization_id = actor_org
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to);

    SELECT count(DISTINCT c.campaign_id)
    INTO v_active_campaigns
    FROM public.contacts c
    INNER JOIN public.campaigns camp ON camp.id = c.campaign_id
    WHERE camp.status = 'ACTIVE'
      AND camp.organization_id = actor_org
      AND c.organization_id = actor_org
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids));
  END IF;

  RETURN jsonb_build_object(
    'totalContacts', v_total,
    'assigned', v_assigned,
    'unassigned', v_unassigned,
    'completed', v_completed,
    'remaining', v_remaining,
    'coming', v_coming,
    'notComing', v_not_coming,
    'unreachable', v_unreachable,
    'switchedOff', v_switched_off,
    'wrongNumber', v_wrong_number,
    'other', v_other,
    'contactsWithNotes', v_notes,
    'activeCampaigns', v_active_campaigns,
    'totalCallAttempts', v_attempts
  );
END;
$$;

-- Org-scope the shared report contact universe (feeds team performance etc.)
-- DROP required: CREATE OR REPLACE cannot change RETURNS TABLE / OUT row type
-- (e.g. older defs without attempt_count / last_attempt_at).
DROP FUNCTION IF EXISTS public.report_contact_universe(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
);

CREATE OR REPLACE FUNCTION public.report_contact_universe(
  p_assignee_ids uuid[],
  p_scope_all boolean,
  p_campaign_id uuid,
  p_response text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  contact_id uuid,
  campaign_id uuid,
  current_assignee_id uuid,
  response public.call_response,
  latest_notes text,
  attempt_count integer,
  last_attempt_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  actor_org uuid;
BEGIN
  actor_org := public.current_organization_id();
  IF actor_org IS NULL THEN
    RETURN;
  END IF;

  IF p_from IS NULL AND p_to IS NULL THEN
    RETURN QUERY
    SELECT
      c.id,
      c.campaign_id,
      c.current_assignee_id,
      c.latest_response,
      c.latest_notes,
      c.attempt_count,
      c.last_attempt_at
    FROM public.contacts c
    WHERE c.organization_id = actor_org
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR c.latest_response::text = p_response);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.campaign_id,
    c.current_assignee_id,
    c.last_attempt_response,
    c.latest_notes,
    c.attempt_count,
    c.last_attempt_at
  FROM public.contacts c
  WHERE c.organization_id = actor_org
    AND c.last_attempt_at IS NOT NULL
    AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
    AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
    AND (p_from IS NULL OR c.last_attempt_at >= p_from)
    AND (p_to IS NULL OR c.last_attempt_at <= p_to)
    AND (p_response IS NULL OR c.last_attempt_response::text = p_response);

  IF p_to IS NOT NULL THEN
    RETURN QUERY
    SELECT
      c.id,
      c.campaign_id,
      c.current_assignee_id,
      latest.response,
      c.latest_notes,
      c.attempt_count,
      c.last_attempt_at
    FROM public.contacts c
    CROSS JOIN LATERAL (
      SELECT ca.response
      FROM public.call_attempts ca
      WHERE ca.contact_id = c.id
        AND ca.attempted_at <= p_to
        AND (p_from IS NULL OR ca.attempted_at >= p_from)
      ORDER BY ca.attempted_at DESC
      LIMIT 1
    ) latest
    WHERE c.organization_id = actor_org
      AND c.last_attempt_at > p_to
      AND (p_scope_all OR c.current_assignee_id = ANY (p_assignee_ids))
      AND (p_campaign_id IS NULL OR c.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR latest.response::text = p_response);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_contact_universe(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_contact_universe(
  uuid[], boolean, uuid, text, timestamptz, timestamptz
) TO authenticated;

-- Recent activity: org-scoped
CREATE OR REPLACE FUNCTION public.get_report_recent_activity(
  p_assignee_ids uuid[] DEFAULT NULL,
  p_scope_all boolean DEFAULT false,
  p_campaign_id uuid DEFAULT NULL,
  p_response text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_has_notes boolean DEFAULT false,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  actor_role public.ministry_role;
  actor_org UUID;
  v_limit integer;
  v_rows jsonb;
BEGIN
  actor_id := public.current_telepastor_id();
  actor_role := public.current_ministry_role();
  actor_org := public.current_organization_id();

  IF actor_id IS NULL OR actor_role IS NULL OR actor_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF actor_role NOT IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER', 'TELEPASTOR') THEN
    RAISE EXCEPTION 'Not authorized for recent activity';
  END IF;

  IF p_scope_all AND actor_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'scope_all is only allowed for SUPER_ADMIN';
  END IF;

  IF actor_role = 'TELEPASTOR' THEN
    IF p_scope_all
      OR p_assignee_ids IS NULL
      OR cardinality(p_assignee_ids) <> 1
      OR p_assignee_ids[1] <> actor_id
    THEN
      RAISE EXCEPTION 'Telepastors may only load their own recent activity';
    END IF;
  END IF;

  IF NOT p_scope_all AND (p_assignee_ids IS NULL OR cardinality(p_assignee_ids) = 0) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 6), 500));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY attempted_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      jsonb_build_object(
        'id', ca.id,
        'contactName', COALESCE(c.name, 'Unknown contact'),
        'telepastorName', COALESCE(caller.name, 'Unknown'),
        'response', ca.response::text,
        'notes', ca.notes,
        'attemptedAt', ca.attempted_at,
        'campaignName', COALESCE(camp.name, 'Unknown campaign')
      ) AS row_data,
      ca.attempted_at
    FROM public.call_attempts ca
    INNER JOIN public.contacts c ON c.id = ca.contact_id
    LEFT JOIN public.telepastors caller ON caller.id = ca.telepastor_id
    LEFT JOIN public.campaigns camp ON camp.id = ca.campaign_id
    WHERE ca.organization_id = actor_org
      AND c.organization_id = actor_org
      AND (p_from IS NULL OR ca.attempted_at >= p_from)
      AND (p_to IS NULL OR ca.attempted_at <= p_to)
      AND (p_campaign_id IS NULL OR ca.campaign_id = p_campaign_id)
      AND (p_response IS NULL OR ca.response::text = p_response)
      AND (
        NOT COALESCE(p_has_notes, false)
        OR (ca.notes IS NOT NULL AND length(btrim(ca.notes)) > 0)
      )
      AND (
        p_scope_all
        OR c.current_assignee_id = ANY (p_assignee_ids)
      )
    ORDER BY ca.attempted_at DESC
    LIMIT v_limit
  ) ranked;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

-- Campaign delete: Super Admin of current org only
DROP POLICY IF EXISTS campaigns_delete_policy ON public.campaigns;
CREATE POLICY campaigns_delete_policy ON public.campaigns
  FOR DELETE
  TO authenticated
  USING (
    public.current_ministry_role() = 'SUPER_ADMIN'
    AND organization_id = public.current_organization_id()
  );

DROP POLICY IF EXISTS contacts_delete_policy ON public.contacts;
CREATE POLICY contacts_delete_policy ON public.contacts
  FOR DELETE
  TO authenticated
  USING (
    public.current_ministry_role() = 'SUPER_ADMIN'
    AND organization_id = public.current_organization_id()
  );

-- Auto-stamp organization_id on child rows from parent when omitted
CREATE OR REPLACE FUNCTION public.trg_stamp_organization_from_campaign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.campaigns
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_stamp_organization_from_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.contacts
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_stamp_organization ON public.contacts;
CREATE TRIGGER contacts_stamp_organization
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_from_campaign();

DROP TRIGGER IF EXISTS contact_imports_stamp_organization ON public.contact_imports;
CREATE TRIGGER contact_imports_stamp_organization
  BEFORE INSERT ON public.contact_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_from_campaign();

DROP TRIGGER IF EXISTS distribution_jobs_stamp_organization ON public.distribution_jobs;
CREATE TRIGGER distribution_jobs_stamp_organization
  BEFORE INSERT ON public.distribution_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_from_campaign();

DROP TRIGGER IF EXISTS contact_assignments_stamp_organization ON public.contact_assignments;
CREATE TRIGGER contact_assignments_stamp_organization
  BEFORE INSERT ON public.contact_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_from_contact();

DROP TRIGGER IF EXISTS call_attempts_stamp_organization ON public.call_attempts;
CREATE TRIGGER call_attempts_stamp_organization
  BEFORE INSERT ON public.call_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_from_contact();

CREATE OR REPLACE FUNCTION public.trg_stamp_organization_on_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;

  IF NEW.organization_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.telepastors
    WHERE id = NEW.actor_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_stamp_organization ON public.audit_logs;
CREATE TRIGGER audit_logs_stamp_organization
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stamp_organization_on_audit_log();

GRANT SELECT ON public.organizations TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_organization_whatsapp_templates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_defaults(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
