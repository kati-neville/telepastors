import type { AuthorizationContext } from "@/lib/auth/permissions";
import { canAccessReports } from "@/lib/auth/permissions";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import type { Telepastor, TelepastorSummary } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

export function canAccessLeadershipReports(context: AuthorizationContext) {
  return canAccessReports(context);
}

export function getReportScopeLabel(role: Telepastor["role"]) {
  switch (role) {
    case "SUPER_ADMIN":
      return "All ministries";
    case "GOVERNOR":
      return "Your organization";
    case "LEADER":
      return "Your team";
    default:
      return "Your assignments";
  }
}

export function getReportableMembers(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  allMembers: TelepastorSummary[],
): TelepastorSummary[] {
  let members = allMembers.filter((member) => member.is_active !== false);

  if (context.telepastor.role === "GOVERNOR") {
    members = members.filter(
      (member) =>
        member.id === context.telepastor.id ||
        (member.role === "LEADER" &&
          member.governor_id === context.telepastor.id) ||
        (member.role === "TELEPASTOR" &&
          getGovernorIdForTelepastor(
            member,
            members.find((entry) => entry.id === member.leader_id),
          ) === context.telepastor.id),
    );
  } else if (context.telepastor.role === "LEADER") {
    members = members.filter(
      (member) =>
        member.id === context.telepastor.id ||
        (member.role === "TELEPASTOR" &&
          member.leader_id === context.telepastor.id),
    );
  } else if (context.telepastor.role === "TELEPASTOR") {
    members = members.filter((member) => member.id === context.telepastor.id);
  }

  if (filters.governorId) {
    members = members.filter(
      (member) =>
        member.id === filters.governorId ||
        (member.role === "LEADER" && member.governor_id === filters.governorId) ||
        (member.role === "TELEPASTOR" &&
          getGovernorIdForTelepastor(
            member,
            members.find((entry) => entry.id === member.leader_id),
          ) === filters.governorId),
    );
  }

  if (filters.leaderId) {
    members = members.filter(
      (member) =>
        member.id === filters.leaderId ||
        (member.role === "TELEPASTOR" && member.leader_id === filters.leaderId),
    );
  }

  if (filters.telepastorId) {
    members = members.filter((member) => member.id === filters.telepastorId);
  }

  return members;
}

export function getScopedAssigneeIds(members: TelepastorSummary[]) {
  return members.map((member) => member.id);
}

export function canViewReportForMember(
  context: AuthorizationContext,
  member: TelepastorSummary,
  allMembers: TelepastorSummary[],
): boolean {
  const scoped = getReportableMembers(context, {}, allMembers);
  return scoped.some((entry) => entry.id === member.id);
}
