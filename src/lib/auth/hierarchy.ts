import type { MinistryRole, Telepastor } from "@/types/domain";

export type HierarchyInput = {
  role: MinistryRole;
  leader_id?: string | null;
  governor_id?: string | null;
};

export type HierarchyLookup = Pick<
  Telepastor,
  "id" | "role" | "governor_id" | "leader_id"
>;

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

  if (actorRole === "GOVERNOR") {
    return ["LEADER", "TELEPASTOR"];
  }

  if (actorRole === "LEADER") {
    return ["TELEPASTOR"];
  }

  return [];
}

export function validateCreatePlacement(
  actor: Pick<Telepastor, "id" | "role">,
  input: HierarchyInput,
  leader?: HierarchyLookup | null,
  governor?: HierarchyLookup | null,
): string | null {
  const assignable = getAssignableRolesForCreate(actor.role);
  if (!assignable.includes(input.role)) {
    return `You are not allowed to create members with the ${input.role} role.`;
  }

  if (actor.role === "LEADER") {
    if (input.role !== "TELEPASTOR") {
      return "Leaders can only create Telepastors.";
    }
    if (input.leader_id !== actor.id) {
      return "Leaders can only assign new Telepastors to themselves.";
    }
    return null;
  }

  if (actor.role === "GOVERNOR") {
    if (input.role === "LEADER") {
      if (input.governor_id !== actor.id) {
        return "Governors can only create Leaders under their own organization.";
      }
      return null;
    }

    if (input.role === "TELEPASTOR") {
      if (!leader || leader.role !== "LEADER") {
        return "Selected Leader was not found.";
      }
      if (leader.governor_id !== actor.id) {
        return "Telepastors must be assigned to a Leader in your organization.";
      }
      return null;
    }
  }

  if (actor.role === "SUPER_ADMIN") {
    if (input.role === "LEADER") {
      if (!governor || governor.role !== "GOVERNOR") {
        return "Selected Governor was not found.";
      }
      return null;
    }

    if (input.role === "TELEPASTOR") {
      if (!leader || leader.role !== "LEADER") {
        return "Selected Leader was not found.";
      }
      return null;
    }
  }

  return null;
}

export function getAssignableRolesForPromotion(): MinistryRole[] {
  return ["GOVERNOR", "LEADER", "TELEPASTOR"];
}
