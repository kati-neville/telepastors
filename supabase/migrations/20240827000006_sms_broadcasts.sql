-- Phase 7: SMS broadcasts and WhatsApp message templates

CREATE TYPE public.sms_broadcast_status AS ENUM (
  'PENDING',
  'SENDING',
  'COMPLETED',
  'FAILED',
  'UNAVAILABLE'
);

CREATE TYPE public.sms_recipient_status AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'SKIPPED'
);

CREATE TYPE public.broadcast_recipient_scope AS ENUM (
  'CAMPAIGN',
  'SELECTED_CONTACTS',
  'GOVERNOR_ORG',
  'LEADER_ORG',
  'TELEPASTOR_ASSIGNMENTS',
  'RESPONSE_TYPE'
);

CREATE TABLE public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_message_templates_active_idx
  ON public.whatsapp_message_templates (is_active);

CREATE TRIGGER whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.sms_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  recipient_scope public.broadcast_recipient_scope NOT NULL,
  scope_config JSONB NOT NULL DEFAULT '{}',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  estimated_sms_units INTEGER,
  provider TEXT,
  status public.sms_broadcast_status NOT NULL DEFAULT 'PENDING',
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sms_broadcasts_created_at_idx ON public.sms_broadcasts (created_at DESC);
CREATE INDEX sms_broadcasts_status_idx ON public.sms_broadcasts (status);
CREATE INDEX sms_broadcasts_campaign_id_idx ON public.sms_broadcasts (campaign_id);

CREATE TABLE public.sms_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.sms_broadcasts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone_normalized TEXT NOT NULL,
  contact_name TEXT,
  status public.sms_recipient_status NOT NULL DEFAULT 'PENDING',
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX sms_broadcast_recipients_broadcast_id_idx
  ON public.sms_broadcast_recipients (broadcast_id);

INSERT INTO public.whatsapp_message_templates (name, slug, body, is_default, is_active)
VALUES
  (
    'Service reminder',
    'service-reminder',
    'Hello {name}, this is a reminder about {campaign}. We look forward to seeing you. God bless!',
    true,
    true
  ),
  (
    'General check-in',
    'general-check-in',
    'Hello {name}, we are checking in from First Love Church. How are you doing today?',
    false,
    true
  ),
  (
    'Follow-up',
    'follow-up',
    'Hello {name}, thank you for speaking with us about {campaign}. We wanted to follow up with you.',
    false,
    true
  ),
  (
    'New convert check-in',
    'new-convert-check-in',
    'Hello {name}, welcome! We are glad to connect with you and wanted to check in personally.',
    false,
    true
  );

CREATE OR REPLACE FUNCTION public.can_manage_whatsapp_templates()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() IN ('SUPER_ADMIN', 'GOVERNOR', 'LEADER');
$$;

CREATE OR REPLACE FUNCTION public.can_send_sms_broadcasts()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_ministry_role() = 'SUPER_ADMIN';
$$;

ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_templates_select_policy ON public.whatsapp_message_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.can_manage_whatsapp_templates());

CREATE POLICY whatsapp_templates_insert_policy ON public.whatsapp_message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_whatsapp_templates());

CREATE POLICY whatsapp_templates_update_policy ON public.whatsapp_message_templates
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_whatsapp_templates())
  WITH CHECK (public.can_manage_whatsapp_templates());

CREATE POLICY sms_broadcasts_select_policy ON public.sms_broadcasts
  FOR SELECT
  TO authenticated
  USING (public.can_send_sms_broadcasts());

CREATE POLICY sms_broadcasts_insert_policy ON public.sms_broadcasts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_send_sms_broadcasts()
    AND created_by = public.current_telepastor_id()
  );

CREATE POLICY sms_broadcasts_update_policy ON public.sms_broadcasts
  FOR UPDATE
  TO authenticated
  USING (public.can_send_sms_broadcasts())
  WITH CHECK (public.can_send_sms_broadcasts());

CREATE POLICY sms_broadcast_recipients_select_policy ON public.sms_broadcast_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sms_broadcasts b
      WHERE b.id = broadcast_id
        AND public.can_send_sms_broadcasts()
    )
  );

CREATE POLICY sms_broadcast_recipients_insert_policy ON public.sms_broadcast_recipients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sms_broadcasts b
      WHERE b.id = broadcast_id
        AND public.can_send_sms_broadcasts()
    )
  );

CREATE POLICY sms_broadcast_recipients_update_policy ON public.sms_broadcast_recipients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sms_broadcasts b
      WHERE b.id = broadcast_id
        AND public.can_send_sms_broadcasts()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sms_broadcasts b
      WHERE b.id = broadcast_id
        AND public.can_send_sms_broadcasts()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_message_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sms_broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sms_broadcast_recipients TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_whatsapp_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_sms_broadcasts() TO authenticated;
