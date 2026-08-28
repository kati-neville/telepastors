-- Allow ministry members to read their own audit log entries (needed for
-- distribution retain repair and personal activity history).

CREATE POLICY audit_logs_select_own_policy ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (actor_id = public.current_telepastor_id());
