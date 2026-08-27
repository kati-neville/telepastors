import type { CallResponse, CampaignStatistics, Contact } from "@/types/domain";

export type ContactStatRow = Pick<
  Contact,
  | "id"
  | "campaign_id"
  | "latest_response"
  | "assignment_status"
  | "current_assignee_id"
>;

export function emptyCampaignStatistics(): CampaignStatistics {
  return {
    totalContacts: 0,
    assigned: 0,
    unassigned: 0,
    completed: 0,
    remaining: 0,
    totalCallAttempts: 0,
    coming: 0,
    notComing: 0,
    unreachable: 0,
    wrongNumber: 0,
    other: 0,
    completionPercentage: 0,
    reachRate: 0,
    comingPercentage: 0,
  };
}

export function computeContactStatistics(
  contacts: ContactStatRow[],
  totalCallAttempts = 0,
): CampaignStatistics {
  const stats = emptyCampaignStatistics();
  stats.totalContacts = contacts.length;
  stats.totalCallAttempts = totalCallAttempts;

  for (const contact of contacts) {
    if (contact.current_assignee_id) {
      stats.assigned += 1;
    } else {
      stats.unassigned += 1;
    }

    if (!contact.latest_response) {
      stats.remaining += 1;
      continue;
    }

    stats.completed += 1;

    switch (contact.latest_response) {
      case "COMING":
        stats.coming += 1;
        break;
      case "NOT_COMING":
        stats.notComing += 1;
        break;
      case "UNREACHABLE":
        stats.unreachable += 1;
        break;
      case "WRONG_NUMBER":
        stats.wrongNumber += 1;
        break;
      case "OTHER":
        stats.other += 1;
        break;
    }
  }

  const denominator = stats.totalContacts > 0 ? stats.totalContacts : 0;
  stats.completionPercentage =
    denominator > 0
      ? Math.round((stats.completed / denominator) * 1000) / 10
      : 0;

  const reached =
    stats.coming + stats.notComing + stats.wrongNumber + stats.other;
  stats.reachRate =
    denominator > 0 ? Math.round((reached / denominator) * 1000) / 10 : 0;

  stats.comingPercentage =
    stats.completed > 0
      ? Math.round((stats.coming / stats.completed) * 1000) / 10
      : 0;

  return stats;
}

export function groupContactsByAssignee(contacts: ContactStatRow[]) {
  const groups = new Map<string, ContactStatRow[]>();

  for (const contact of contacts) {
    if (!contact.current_assignee_id) continue;

    const existing = groups.get(contact.current_assignee_id) ?? [];
    existing.push(contact);
    groups.set(contact.current_assignee_id, existing);
  }

  return groups;
}

export function countResponses(contacts: ContactStatRow[]) {
  const counts: Record<CallResponse, number> = {
    COMING: 0,
    NOT_COMING: 0,
    UNREACHABLE: 0,
    WRONG_NUMBER: 0,
    OTHER: 0,
  };

  for (const contact of contacts) {
    if (contact.latest_response) {
      counts[contact.latest_response] += 1;
    }
  }

  return counts;
}
