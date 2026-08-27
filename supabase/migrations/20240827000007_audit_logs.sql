-- Phase 8: Audit logging for important ministry actions

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.telepastors(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = public.current_telepastor_id());

CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.current_ministry_role() = 'SUPER_ADMIN');

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
