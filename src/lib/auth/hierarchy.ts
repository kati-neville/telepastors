import type { MinistryRole } from "@/types/domain";

export type HierarchyInput = {
  role: MinistryRole;
  leader_id?: string | null;
  governor_id?: string | null;
};

export function resolveHierarchyFields(input: HierarchyInput): {
  leader_id: string | null;
  governor_id: string | null;
} {
  switch (input.role) {
    case "SUPER_ADMIN":
    case "GOVERNOR":
      return { leader_id: null, governor_id: null };
    case "LEADER":
      return {
        leader_id: null,
        governor_id: input.governor_id ?? null,
      };
    case "TELEPASTOR":
      return {
        leader_id: input.leader_id ?? null,
        governor_id: null,
      };
  }
}

export function validateHierarchy(input: HierarchyInput): string | null {
  const { role, leader_id, governor_id } = input;

  if (role === "SUPER_ADMIN" || role === "GOVERNOR") {
    if (leader_id || governor_id) {
      return "Governors and Super Admins cannot have a Leader or Governor assigned.";
    }
    return null;
  }

  if (role === "LEADER") {
    if (leader_id) {
      return "Leaders cannot have a Leader assigned.";
    }
    if (!governor_id) {
      return "Leaders must be assigned to a Governor.";
    }
    return null;
  }

  if (role === "TELEPASTOR") {
    if (governor_id) {
      return "Telepastors are linked to a Governor through their Leader.";
    }
    if (!leader_id) {
      return "Telepastors must be assigned to a Leader.";
    }
    return null;
  }

  return null;
}

export function getAssignableRolesForCreate(
  actorRole: MinistryRole,
): MinistryRole[] {
  if (actorRole === "SUPER_ADMIN") {
    return ["GOVERNOR", "LEADER", "TELEPASTOR"];
  }

  return [];
}

export function getAssignableRolesForPromotion(): MinistryRole[] {
  return ["GOVERNOR", "LEADER", "TELEPASTOR"];
}
