import type { AuthorizationContext } from "@/lib/auth/permissions";
import { hasRoleAtLeast } from "@/lib/auth/roles";

export function canSendSmsBroadcasts(context: AuthorizationContext): boolean {
  return context.telepastor.role === "SUPER_ADMIN";
}

export function canManageWhatsAppTemplates(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "LEADER");
}

export function canViewWhatsAppTemplates(context: AuthorizationContext): boolean {
  return (
    canManageWhatsAppTemplates(context) ||
    context.telepastor.role === "TELEPASTOR"
  );
}
