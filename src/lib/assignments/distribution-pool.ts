export const RETAINED_FOR_CALLING_NOTE = "__retained_for_calling__";

export type DistributionAssignmentSnapshot = {
  assigned_by: string | null;
  assignee_id: string;
  notes: string | null;
};

export function isRetainedForCallingAssignment(
  assignment: DistributionAssignmentSnapshot,
  actorId: string,
): boolean {
  if (assignment.notes?.includes(RETAINED_FOR_CALLING_NOTE)) {
    return true;
  }

  return (
    assignment.assigned_by === actorId && assignment.assignee_id === actorId
  );
}

export function isContactReadyForDownstreamDistribution(
  contact: {
    current_assignee_id: string | null;
    assignment_status: string;
    held_for_own_calls?: boolean;
  },
  assignment: DistributionAssignmentSnapshot | null | undefined,
  actorId: string,
  pool: "unassigned" | "assigned_to_self",
): boolean {
  if (pool === "unassigned") {
    return contact.assignment_status === "UNASSIGNED";
  }

  if (contact.held_for_own_calls) {
    return false;
  }

  if (contact.current_assignee_id !== actorId || !assignment) {
    return false;
  }

  if (isRetainedForCallingAssignment(assignment, actorId)) {
    return false;
  }

  return assignment.assigned_by !== actorId;
}
