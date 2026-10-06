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
    switchedOff: 0,
    wrongNumber: 0,
    other: 0,
    completionPercentage: 0,
    reachRate: 0,
    comingPercentage: 0,
  };
}

export type CampaignStatCounts = {
  totalContacts?: number;
  assigned?: number;
  unassigned?: number;
  completed?: number;
  remaining?: number;
  coming?: number;
  notComing?: number;
  unreachable?: number;
  switchedOff?: number;
  wrongNumber?: number;
  other?: number;
  totalCallAttempts?: number;
};

export function asStatCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function withDerivedCampaignRates(
  stats: CampaignStatistics,
): CampaignStatistics {
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

export function campaignStatisticsFromCounts(
  raw: CampaignStatCounts,
): CampaignStatistics {
  const stats = emptyCampaignStatistics();
  stats.totalContacts = asStatCount(raw.totalContacts);
  stats.assigned = asStatCount(raw.assigned);
  stats.unassigned = asStatCount(raw.unassigned);
  stats.completed = asStatCount(raw.completed);
  stats.remaining = asStatCount(raw.remaining);
  stats.coming = asStatCount(raw.coming);
  stats.notComing = asStatCount(raw.notComing);
  stats.unreachable = asStatCount(raw.unreachable);
  stats.switchedOff = asStatCount(raw.switchedOff);
  stats.wrongNumber = asStatCount(raw.wrongNumber);
  stats.other = asStatCount(raw.other);
  stats.totalCallAttempts = asStatCount(raw.totalCallAttempts);
  return withDerivedCampaignRates(stats);
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
      case "SWITCHED_OFF":
        stats.switchedOff += 1;
        break;
      case "WRONG_NUMBER":
        stats.wrongNumber += 1;
        break;
      case "OTHER":
        stats.other += 1;
        break;
    }
  }

  return withDerivedCampaignRates(stats);
}

export function getReachedContactCount(
  stats: Pick<
    CampaignStatistics,
    "coming" | "notComing" | "wrongNumber" | "other"
  >,
) {
  return stats.coming + stats.notComing + stats.wrongNumber + stats.other;
}

export function percentOf(part: number, whole: number) {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 1000) / 10;
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
    SWITCHED_OFF: 0,
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
