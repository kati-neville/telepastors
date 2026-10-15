import type { MinistryRole } from "@/types/domain";

export type CampaignAssigneeUndoRow = {
  assigneeId: string;
  name: string;
  role: MinistryRole;
  assignedCount: number;
  attemptedCount: number;
  unattemptedCount: number;
};

export type AssigneeContactCallStatus = {
  contactId: string;
  assigneeId: string;
  isCalled: boolean;
};

export function aggregateAssigneeUndoRows(
  contacts: AssigneeContactCallStatus[],
  people: Map<string, { name: string; role: MinistryRole }>,
): CampaignAssigneeUndoRow[] {
  const counts = new Map<
    string,
    { assignedCount: number; attemptedCount: number; unattemptedCount: number }
  >();

  for (const contact of contacts) {
    const current = counts.get(contact.assigneeId) ?? {
      assignedCount: 0,
      attemptedCount: 0,
      unattemptedCount: 0,
    };

    current.assignedCount += 1;
    if (contact.isCalled) {
      current.attemptedCount += 1;
    } else {
      current.unattemptedCount += 1;
    }

    counts.set(contact.assigneeId, current);
  }

  return [...counts.entries()]
    .map(([assigneeId, value]) => {
      const person = people.get(assigneeId);
      return {
        assigneeId,
        name: person?.name ?? "Unknown",
        role: person?.role ?? "TELEPASTOR",
        assignedCount: value.assignedCount,
        attemptedCount: value.attemptedCount,
        unattemptedCount: value.unattemptedCount,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
