import {
  getGovernorIdForTelepastor,
  hasRoleAtLeast,
  type MinistryRole,
} from "@/lib/auth/roles";
import { canDistributeContacts } from "@/lib/auth/assignments";
import { canSendSmsBroadcasts } from "@/lib/auth/broadcasts";
import type { Telepastor } from "@/types/domain";

export type AuthorizationContext = {
  telepastor: Telepastor;
  leader?: Pick<Telepastor, "id" | "governor_id"> | null;
};

export function canChangeRole(context: AuthorizationContext): boolean {
  return context.telepastor.role === "SUPER_ADMIN";
}

export function canManageTelepastor(
  context: AuthorizationContext,
  target: Telepastor,
): boolean {
  if (context.telepastor.id === target.id) {
    return false;
  }

  if (context.telepastor.role === "SUPER_ADMIN") {
    return true;
  }

  return (
    canViewUser(context, target) &&
    (context.telepastor.role === "GOVERNOR" ||
      context.telepastor.role === "LEADER")
  );
}

export function canCreateTelepastor(context: AuthorizationContext): boolean {
  return context.telepastor.role === "SUPER_ADMIN";
}

export function canEditTelepastorProfile(
  context: AuthorizationContext,
  target: Telepastor,
): boolean {
  if (context.telepastor.id === target.id) {
    return true;
  }

  return canManageTelepastor(context, target);
}

export function canToggleTelepastorActive(
  context: AuthorizationContext,
  target: Telepastor,
): boolean {
  if (context.telepastor.id === target.id) {
    return false;
  }

  return canManageTelepastor(context, target);
}

export function canManageUsers(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "LEADER");
}

export function canViewUser(
  context: AuthorizationContext,
  target: Telepastor,
  targetLeader?: Pick<Telepastor, "governor_id"> | null,
): boolean {
  if (context.telepastor.id === target.id) {
    return true;
  }

  if (context.telepastor.role === "SUPER_ADMIN") {
    return true;
  }

  const viewerGovernorScope =
    context.telepastor.role === "GOVERNOR" ? context.telepastor.id : null;

  if (viewerGovernorScope) {
    if (target.role === "LEADER" && target.governor_id === viewerGovernorScope) {
      return true;
    }

    if (target.role === "TELEPASTOR") {
      const targetGovernorId = getGovernorIdForTelepastor(target, targetLeader);
      return targetGovernorId === viewerGovernorScope;
    }
  }

  if (context.telepastor.role === "LEADER") {
    return target.role === "TELEPASTOR" && target.leader_id === context.telepastor.id;
  }

  return false;
}

export function canViewOrganization(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "LEADER");
}

export function canManageCampaign(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "GOVERNOR");
}

export function canCreateCampaign(context: AuthorizationContext): boolean {
  return canManageCampaign(context);
}

export function canEditCampaign(context: AuthorizationContext): boolean {
  return canManageCampaign(context);
}

export function canDeleteCampaign(context: AuthorizationContext): boolean {
  return context.telepastor.role === "SUPER_ADMIN";
}

export function canImportCampaignContacts(
  context: AuthorizationContext,
): boolean {
  return context.telepastor.role === "SUPER_ADMIN";
}

export function canAssignContacts(context: AuthorizationContext): boolean {
  return canDistributeContacts(context);
}

export function canAccessBroadcasts(context: AuthorizationContext): boolean {
  return canSendSmsBroadcasts(context);
}

export function canAccessReports(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "LEADER");
}

export function canAccessTelepastorsDirectory(
  context: AuthorizationContext,
): boolean {
  return hasRoleAtLeast(context.telepastor.role, "LEADER");
}

export function canAccessBirthdays(context: AuthorizationContext): boolean {
  return (
    context.telepastor.role === "SUPER_ADMIN" ||
    context.telepastor.role === "GOVERNOR" ||
    context.telepastor.role === "LEADER"
  );
}

export function canAccessCampaigns(context: AuthorizationContext): boolean {
  return hasRoleAtLeast(context.telepastor.role, "GOVERNOR");
}

export function canAccessMyCalls(context: AuthorizationContext): boolean {
  return (
    context.telepastor.is_active &&
    (context.telepastor.role === "GOVERNOR" ||
      context.telepastor.role === "LEADER" ||
      context.telepastor.role === "TELEPASTOR")
  );
}

export function isAuthorizedForRole(
  role: MinistryRole,
  allowedRoles: MinistryRole[],
): boolean {
  return allowedRoles.includes(role);
}
