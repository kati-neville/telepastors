import type { MinistryRole, TeamMemberStatistics, TelepastorSummary, TeamPerformanceBundle } from "@/types/domain";
import type { ReportFilterValues, TeamPerformanceView } from "@/lib/validations/reports";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";

export type TeamPerformanceScope = {
  view: TeamPerformanceView;
  governorId?: string;
  leaderId?: string;
};

export type TeamPerformanceCrumb = {
  label: string;
  scope: TeamPerformanceScope;
};

export const TEAM_PERFORMANCE_VIEW_LABELS: Record<TeamPerformanceView, string> = {
  governor: "Governor",
  leader: "Leader",
  telepastor: "Telepastor",
};

export function getAvailableTeamPerformanceViews(
  role: MinistryRole,
): TeamPerformanceView[] {
  switch (role) {
    case "SUPER_ADMIN":
      return ["governor", "leader", "telepastor"];
    case "GOVERNOR":
      return ["leader", "telepastor"];
    case "LEADER":
      return ["telepastor"];
    default:
      return [];
  }
}

export function getDefaultTeamPerformanceView(
  role: MinistryRole,
): TeamPerformanceView {
  switch (role) {
    case "SUPER_ADMIN":
      return "governor";
    case "GOVERNOR":
      return "leader";
    case "LEADER":
      return "telepastor";
    default:
      return "telepastor";
  }
}

export function resolveTeamPerformanceView(
  role: MinistryRole,
  view: TeamPerformanceView | undefined,
): TeamPerformanceView {
  const available = getAvailableTeamPerformanceViews(role);
  if (available.length === 0) {
    return "telepastor";
  }

  if (view && available.includes(view)) {
    return view;
  }

  return getDefaultTeamPerformanceView(role);
}

export function getTeamPerformanceTitle(
  role: MinistryRole,
  view: TeamPerformanceView,
): string {
  switch (view) {
    case "governor":
      return "Governor progress";
    case "leader":
      return "Leader progress";
    case "telepastor":
      return role === "LEADER" ? "Telepastor performance" : "Telepastor progress";
  }
}

export function memberMatchesPerformanceView(
  role: MinistryRole,
  view: TeamPerformanceView,
): boolean {
  switch (view) {
    case "governor":
      return role === "GOVERNOR";
    case "leader":
      return role === "LEADER";
    case "telepastor":
      return role === "TELEPASTOR";
  }
}

export function canDrillDownFromRow(
  actorRole: MinistryRole,
  view: TeamPerformanceView,
  row: TeamMemberStatistics,
): boolean {
  if (view === "telepastor") {
    return false;
  }

  if (view === "governor") {
    return actorRole === "SUPER_ADMIN" && row.memberRole === "GOVERNOR";
  }

  if (view === "leader") {
    return (
      (actorRole === "SUPER_ADMIN" || actorRole === "GOVERNOR") &&
      row.memberRole === "LEADER"
    );
  }

  return false;
}

export function applyTeamPerformanceViewChange(
  currentScope: TeamPerformanceScope,
  nextView: TeamPerformanceView,
): TeamPerformanceScope {
  if (nextView === "governor") {
    return { view: "governor" };
  }

  if (nextView === "leader") {
    return {
      view: "leader",
      governorId: currentScope.governorId,
    };
  }

  return {
    view: "telepastor",
    governorId: currentScope.governorId,
    leaderId: currentScope.leaderId,
  };
}

export function buildTeamMemberDrillDownScope(
  actorRole: MinistryRole,
  view: TeamPerformanceView,
  row: TeamMemberStatistics,
  scope: TeamPerformanceScope,
): TeamPerformanceScope | null {
  if (!canDrillDownFromRow(actorRole, view, row)) {
    return null;
  }

  if (view === "governor" && row.memberRole === "GOVERNOR") {
    return {
      view: "leader",
      governorId: row.memberId,
    };
  }

  if (view === "leader" && row.memberRole === "LEADER") {
    return {
      view: "telepastor",
      governorId: scope.governorId,
      leaderId: row.memberId,
    };
  }

  return null;
}

export function selectTeamPerformanceRows(
  bundle: TeamPerformanceBundle,
  actorRole: MinistryRole,
  scope: TeamPerformanceScope,
): TeamMemberStatistics[] {
  const { view, governorId, leaderId } = scope;
  const memberById = new Map(bundle.members.map((member) => [member.id, member]));

  if (view === "governor" && actorRole === "SUPER_ADMIN") {
    return bundle.governorRows;
  }

  if (view === "leader") {
    return bundle.memberRows.filter((row) => {
      if (row.memberRole !== "LEADER") {
        return false;
      }

      if (!governorId) {
        return true;
      }

      return memberById.get(row.memberId)?.governor_id === governorId;
    });
  }

  return bundle.memberRows.filter((row) => {
    if (row.memberRole !== "TELEPASTOR") {
      return false;
    }

    const member = memberById.get(row.memberId);
    if (!member) {
      return false;
    }

    if (leaderId) {
      return member.leader_id === leaderId;
    }

    if (governorId) {
      const leader = member.leader_id
        ? memberById.get(member.leader_id)
        : null;

      return getGovernorIdForTelepastor(member, leader) === governorId;
    }

    return true;
  });
}

export function createInitialTeamPerformanceScope(
  role: MinistryRole,
  filters: ReportFilterValues,
): TeamPerformanceScope {
  return {
    view: resolveTeamPerformanceView(role, filters.view),
    governorId: filters.governorId,
    leaderId: filters.leaderId,
  };
}

export function getTeamPerformanceBreadcrumbItems(
  role: MinistryRole,
  scope: TeamPerformanceScope,
  memberNames: {
    governorName?: string | null;
    leaderName?: string | null;
  },
): TeamPerformanceCrumb[] {
  const crumbs: TeamPerformanceCrumb[] = [];

  if (role === "SUPER_ADMIN" && scope.governorId) {
    crumbs.push({
      label: "All governors",
      scope: { view: "governor" },
    });

    if (memberNames.governorName) {
      crumbs.push({
        label: memberNames.governorName,
        scope: {
          view: "leader",
          governorId: scope.governorId,
        },
      });
    }
  }

  if (scope.leaderId && memberNames.leaderName) {
    if (role === "GOVERNOR") {
      crumbs.push({
        label: "All leaders",
        scope: { view: "leader" },
      });
    }

    crumbs.push({
      label: memberNames.leaderName,
      scope: {
        view: "telepastor",
        governorId: scope.governorId,
        leaderId: scope.leaderId,
      },
    });
  }

  return crumbs;
}

export function buildTeamMemberDrillDownQuery(
  actorRole: MinistryRole,
  view: TeamPerformanceView,
  row: TeamMemberStatistics,
  filters: ReportFilterValues,
): Record<string, string | undefined> | null {
  if (!canDrillDownFromRow(actorRole, view, row)) {
    return null;
  }

  if (view === "governor" && row.memberRole === "GOVERNOR") {
    return {
      view: "leader",
      governorId: row.memberId,
      leaderId: undefined,
      telepastorId: undefined,
    };
  }

  if (view === "leader" && row.memberRole === "LEADER") {
    return {
      view: "telepastor",
      governorId: filters.governorId,
      leaderId: row.memberId,
      telepastorId: undefined,
    };
  }

  return null;
}

export function buildTeamPerformanceScopeHref(
  basePath: string,
  filters: ReportFilterValues,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();

  const merged: ReportFilterValues = {
    ...filters,
    ...updates,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function getTeamPerformanceBreadcrumb(
  role: MinistryRole,
  filters: ReportFilterValues,
  basePath: string,
  memberNames: {
    governorName?: string | null;
    leaderName?: string | null;
  },
): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [];

  if (role === "SUPER_ADMIN" && filters.governorId) {
    crumbs.push({
      label: "All governors",
      href: buildTeamPerformanceScopeHref(basePath, filters, {
        view: "governor",
        governorId: undefined,
        leaderId: undefined,
        telepastorId: undefined,
      }),
    });

    if (memberNames.governorName) {
      crumbs.push({
        label: memberNames.governorName,
        href: buildTeamPerformanceScopeHref(basePath, filters, {
          view: "leader",
          leaderId: undefined,
          telepastorId: undefined,
        }),
      });
    }
  }

  if (filters.leaderId && memberNames.leaderName) {
    if (role === "GOVERNOR") {
      crumbs.push({
        label: "All leaders",
        href: buildTeamPerformanceScopeHref(basePath, filters, {
          view: "leader",
          leaderId: undefined,
          telepastorId: undefined,
        }),
      });
    }

    crumbs.push({
      label: memberNames.leaderName,
      href: buildTeamPerformanceScopeHref(basePath, filters, {
        view: "telepastor",
        telepastorId: undefined,
      }),
    });
  }

  return crumbs;
}
