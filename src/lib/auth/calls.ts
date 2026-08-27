import type { AuthorizationContext } from "@/lib/auth/permissions";
import type { Contact } from "@/types/domain";

export function canAccessCallQueue(context: AuthorizationContext): boolean {
  return (
    context.telepastor.is_active && context.telepastor.role === "TELEPASTOR"
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

  if (context.telepastor.role === "TELEPASTOR") {
    return contact.current_assignee_id === context.telepastor.id;
  }

  return false;
}
