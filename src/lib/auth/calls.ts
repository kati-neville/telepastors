import type { AuthorizationContext } from "@/lib/auth/permissions";
import type { Contact } from "@/types/domain";

const CALLING_ROLES = new Set(["GOVERNOR", "LEADER", "TELEPASTOR"]);

export function canAccessCallQueue(context: AuthorizationContext): boolean {
  return (
    context.telepastor.is_active && CALLING_ROLES.has(context.telepastor.role)
  );
}

export function canRecordCallAttempt(
  context: AuthorizationContext,
  contact: Pick<Contact, "current_assignee_id">,
): boolean {
  if (!canAccessCallQueue(context)) {
    return false;
  }

  return contact.current_assignee_id === context.telepastor.id;
}

export function canViewAssignedContact(
  context: AuthorizationContext,
  contact: Pick<Contact, "current_assignee_id">,
): boolean {
  if (context.telepastor.role === "SUPER_ADMIN") {
    return true;
  }

  if (canAccessCallQueue(context)) {
    return contact.current_assignee_id === context.telepastor.id;
  }

  return false;
}
