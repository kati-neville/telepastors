import type { MinistryRole, Telepastor } from "@/types/domain";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";

export type DistributionLevel = "SUPER_ADMIN" | "GOVERNOR" | "LEADER";

export function canDistributeContacts(context: AuthorizationContext): boolean {
  return (
    context.telepastor.role === "SUPER_ADMIN" ||
    context.telepastor.role === "GOVERNOR" ||
    context.telepastor.role === "LEADER"
  );
}

export function getDistributionLevel(
  role: MinistryRole,
): DistributionLevel | null {
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "GOVERNOR") return "GOVERNOR";
  if (role === "LEADER") return "LEADER";
  return null;
}

export function getTargetAssigneeRole(
  actorRole: MinistryRole,
): MinistryRole | null {
  switch (actorRole) {
    case "SUPER_ADMIN":
      return "GOVERNOR";
    case "GOVERNOR":
      return "LEADER";
    case "LEADER":
      return "TELEPASTOR";
    default:
      return null;
  }
}

export function canAssignContactToAssignee(
  context: AuthorizationContext,
  assignee: Pick<Telepastor, "id" | "role" | "governor_id" | "leader_id">,
): boolean {
  if (context.telepastor.role === "SUPER_ADMIN") {
    return assignee.role === "GOVERNOR";
  }

  if (context.telepastor.role === "GOVERNOR") {
    if (
      assignee.role === "LEADER" &&
      assignee.governor_id === context.telepastor.id
    ) {
      return true;
    }

    // Leaderless Telepastors in this governor's org only
    return (
      assignee.role === "TELEPASTOR" &&
      assignee.leader_id === null &&
      assignee.governor_id === context.telepastor.id
    );
  }

  if (context.telepastor.role === "LEADER") {
    return (
      assignee.role === "TELEPASTOR" &&
      assignee.leader_id === context.telepastor.id
    );
  }

  return false;
}

export type ContactForAssignment = {
  id: string;
  campaign_id: string;
  assignment_status: string;
  current_assignee_id: string | null;
};

export function canAssignContact(
  context: AuthorizationContext,
  contact: ContactForAssignment,
): boolean {
  if (!canDistributeContacts(context)) {
    return false;
  }

  if (context.telepastor.role === "SUPER_ADMIN") {
    return true;
  }

  return contact.current_assignee_id === context.telepastor.id;
}

export function assigneeIsInGovernorOrg(
  governorId: string,
  assignee: Pick<Telepastor, "id" | "role" | "governor_id" | "leader_id">,
  assigneeLeader?: Pick<Telepastor, "governor_id"> | null,
): boolean {
  if (assignee.role === "GOVERNOR") {
    return assignee.id === governorId;
  }

  if (assignee.role === "LEADER") {
    return assignee.governor_id === governorId;
  }

  if (assignee.role === "TELEPASTOR") {
    return getGovernorIdForTelepastor(assignee, assigneeLeader) === governorId;
  }

  return false;
}

export function getDistributionPoolFilter(
  context: AuthorizationContext,
): "unassigned" | "assigned_to_self" {
  if (context.telepastor.role === "SUPER_ADMIN") {
    return "unassigned";
  }

  return "assigned_to_self";
}

export function getAssigneeLabel(role: MinistryRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Governor";
    case "GOVERNOR":
      return "Leader or Telepastor";
    case "LEADER":
      return "Telepastor";
    default:
      return "Assignee";
  }
}

export function canRetainContactsForCalling(role: MinistryRole): boolean {
  return role === "GOVERNOR" || role === "LEADER";
}
