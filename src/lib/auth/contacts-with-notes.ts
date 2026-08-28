import type { AuthorizationContext } from "@/lib/auth/permissions";
import { canAccessMyCalls, canAccessReports } from "@/lib/auth/permissions";

export function canAccessContactsWithNotes(
  context: AuthorizationContext,
): boolean {
  return canAccessReports(context) || canAccessMyCalls(context);
}
