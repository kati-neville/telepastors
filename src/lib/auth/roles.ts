import {
  MINISTRY_ROLES,
  type MinistryRole,
  type Telepastor,
} from "@/types/domain";

export { MINISTRY_ROLES, type MinistryRole };

const ROLE_RANK: Record<MinistryRole, number> = {
  SUPER_ADMIN: 4,
  GOVERNOR: 3,
  LEADER: 2,
  TELEPASTOR: 1,
};

export function isMinistryRole(value: string): value is MinistryRole {
  return MINISTRY_ROLES.includes(value as MinistryRole);
}

export function hasRoleAtLeast(
  role: MinistryRole,
  minimumRole: MinistryRole,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

export function getRoleLabel(role: MinistryRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "GOVERNOR":
      return "Governor";
    case "LEADER":
      return "Leader";
    case "TELEPASTOR":
      return "Telepastor";
  }
}

export function getGovernorIdForTelepastor(
  telepastor: Pick<Telepastor, "role" | "leader_id" | "governor_id">,
  leader?: Pick<Telepastor, "governor_id"> | null,
): string | null {
  if (telepastor.role === "GOVERNOR" || telepastor.role === "SUPER_ADMIN") {
    return null;
  }

  if (telepastor.role === "LEADER") {
    return telepastor.governor_id;
  }

  if (telepastor.role === "TELEPASTOR") {
    if (telepastor.leader_id) {
      return leader?.governor_id ?? telepastor.governor_id ?? null;
    }
    return telepastor.governor_id ?? null;
  }

  return null;
}

export function getLeaderIdForTelepastor(
  telepastor: Pick<Telepastor, "role" | "leader_id">,
): string | null {
  if (telepastor.role !== "TELEPASTOR") {
    return null;
  }

  return telepastor.leader_id;
}
