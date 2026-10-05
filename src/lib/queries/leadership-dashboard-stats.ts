import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getScopedAssigneeIds } from "@/lib/auth/reports";
import { formatSupabaseError } from "@/lib/supabase/errors";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createClient } from "@/lib/supabase/server";
import {
  computeContactStatistics,
  emptyCampaignStatistics,
  type ContactStatRow,
} from "@/lib/stats/compute";
import type { CampaignStatistics, TelepastorSummary } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

export type LeadershipContactStatsResult = {
  stats: CampaignStatistics;
  activeCampaigns: number;
  contactsWithNotesCount: number;
};

type RawLeadershipStats = {
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
  contactsWithNotes?: number;
  activeCampaigns?: number;
  totalCallAttempts?: number;
};

type LeanContactRow = ContactStatRow & {
  id: string;
  campaign_id: string;
  latest_notes: string | null;
};

const ASSIGNEE_IN_CHUNK = 100;

function asCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finalizeCampaignStatistics(
  raw: RawLeadershipStats,
): CampaignStatistics {
  const stats = emptyCampaignStatistics();
  stats.totalContacts = asCount(raw.totalContacts);
  stats.assigned = asCount(raw.assigned);
  stats.unassigned = asCount(raw.unassigned);
  stats.completed = asCount(raw.completed);
  stats.remaining = asCount(raw.remaining);
  stats.coming = asCount(raw.coming);
  stats.notComing = asCount(raw.notComing);
  stats.unreachable = asCount(raw.unreachable);
  stats.switchedOff = asCount(raw.switchedOff);
  stats.wrongNumber = asCount(raw.wrongNumber);
  stats.other = asCount(raw.other);
  stats.totalCallAttempts = asCount(raw.totalCallAttempts);

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

export function resolveLeadershipContactScope(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  members: TelepastorSummary[],
): { scopeAll: boolean; assigneeIds: string[] } {
  const assigneeIds = getScopedAssigneeIds(members);

  if (
    context.telepastor.role === "SUPER_ADMIN" &&
    !filters.governorId &&
    !filters.leaderId &&
    !filters.telepastorId
  ) {
    return { scopeAll: true, assigneeIds: [] };
  }

  return { scopeAll: false, assigneeIds };
}

function isMissingRpcError(error: {
  message?: string | null;
  code?: string | null;
}) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("get_leadership_dashboard_stats") ||
    message.includes("could not find the function") ||
    message.includes("function public.get_leadership_dashboard_stats")
  );
}

async function fetchLeanScopedContacts(
  scopeAll: boolean,
  assigneeIds: string[],
  filters: ReportFilterValues,
): Promise<LeanContactRow[]> {
  if (!scopeAll && assigneeIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  if (scopeAll) {
    return fetchAllPages<LeanContactRow>(async (from, to) => {
      let query = supabase
        .from("contacts")
        .select(
          "id, campaign_id, latest_response, assignment_status, current_assignee_id, latest_notes",
        )
        .order("id", { ascending: true })
        .range(from, to);

      if (filters.campaignId) {
        query = query.eq("campaign_id", filters.campaignId);
      }
      if (filters.response) {
        query = query.eq("latest_response", filters.response);
      }
      if (filters.from) {
        query = query.gte("latest_response_at", filters.from);
      }
      if (filters.to) {
        query = query.lte("latest_response_at", filters.to);
      }

      return query;
    });
  }

  const rows: LeanContactRow[] = [];
  for (let index = 0; index < assigneeIds.length; index += ASSIGNEE_IN_CHUNK) {
    const batch = assigneeIds.slice(index, index + ASSIGNEE_IN_CHUNK);
    const batchRows = await fetchAllPages<LeanContactRow>(async (from, to) => {
      let query = supabase
        .from("contacts")
        .select(
          "id, campaign_id, latest_response, assignment_status, current_assignee_id, latest_notes",
        )
        .in("current_assignee_id", batch)
        .order("id", { ascending: true })
        .range(from, to);

      if (filters.campaignId) {
        query = query.eq("campaign_id", filters.campaignId);
      }
      if (filters.response) {
        query = query.eq("latest_response", filters.response);
      }
      if (filters.from) {
        query = query.gte("latest_response_at", filters.from);
      }
      if (filters.to) {
        query = query.lte("latest_response_at", filters.to);
      }

      return query;
    });
    rows.push(...batchRows);
  }

  return rows;
}

async function countActiveCampaignsFromContacts(
  scopeAll: boolean,
  contacts: LeanContactRow[],
  filters: ReportFilterValues,
): Promise<number> {
  const supabase = await createClient();

  if (scopeAll) {
    let query = supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE");
    if (filters.campaignId) {
      query = query.eq("id", filters.campaignId);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(
        formatSupabaseError(error, "Failed to count active campaigns."),
      );
    }
    return count ?? 0;
  }

  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];
  if (campaignIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE")
    .in("id", campaignIds);

  if (error) {
    throw new Error(
      formatSupabaseError(error, "Failed to count active campaigns."),
    );
  }

  return count ?? 0;
}

async function countAttemptsForScope(
  scopeAll: boolean,
  contactIds: string[],
  filters: ReportFilterValues,
): Promise<number> {
  const supabase = await createClient();

  // SUPER_ADMIN unscoped (and no response filter): one table count.
  if (scopeAll && !filters.response) {
    let query = supabase
      .from("call_attempts")
      .select("id", { count: "exact", head: true });
    if (filters.campaignId) {
      query = query.eq("campaign_id", filters.campaignId);
    }
    if (filters.from) {
      query = query.gte("attempted_at", filters.from);
    }
    if (filters.to) {
      query = query.lte("attempted_at", filters.to);
    }
    const { count, error } = await query;
    if (error) {
      if (!error.message?.trim()) {
        return 0;
      }
      throw new Error(
        formatSupabaseError(error, "Failed to count call attempts."),
      );
    }
    return count ?? 0;
  }

  if (contactIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < contactIds.length; index += ASSIGNEE_IN_CHUNK) {
    const batch = contactIds.slice(index, index + ASSIGNEE_IN_CHUNK);
    let query = supabase
      .from("call_attempts")
      .select("id", { count: "exact", head: true })
      .in("contact_id", batch);

    if (filters.from) {
      query = query.gte("attempted_at", filters.from);
    }
    if (filters.to) {
      query = query.lte("attempted_at", filters.to);
    }

    const { count, error } = await query;
    if (error) {
      if (!error.message?.trim()) {
        continue;
      }
      throw new Error(
        formatSupabaseError(error, "Failed to count call attempts."),
      );
    }
    total += count ?? 0;
  }

  return total;
}

/**
 * Reliable fallback when the dashboard stats RPC is missing/unavailable.
 * One lean contact scan (+ attempt counts) instead of many parallel HEAD counts
 * that time out under RLS for SUPER_ADMIN.
 */
async function fetchLeadershipContactStatsViaScan(
  scopeAll: boolean,
  assigneeIds: string[],
  filters: ReportFilterValues,
): Promise<LeadershipContactStatsResult> {
  const contacts = await fetchLeanScopedContacts(scopeAll, assigneeIds, filters);
  const contactIds = contacts.map((contact) => contact.id);

  const [totalCallAttempts, activeCampaigns] = await Promise.all([
    countAttemptsForScope(scopeAll, contactIds, filters),
    countActiveCampaignsFromContacts(scopeAll, contacts, filters),
  ]);

  const stats = computeContactStatistics(contacts, totalCallAttempts);
  const contactsWithNotesCount = contacts.filter(
    (contact) => Boolean(contact.latest_notes?.trim()),
  ).length;

  return {
    stats,
    activeCampaigns,
    contactsWithNotesCount,
  };
}

export async function fetchLeadershipContactStats(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  members: TelepastorSummary[],
): Promise<LeadershipContactStatsResult> {
  const { scopeAll, assigneeIds } = resolveLeadershipContactScope(
    context,
    filters,
    members,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leadership_dashboard_stats", {
    p_assignee_ids: scopeAll ? null : assigneeIds,
    p_scope_all: scopeAll,
    p_campaign_id: filters.campaignId ?? null,
    p_response: filters.response ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return fetchLeadershipContactStatsViaScan(scopeAll, assigneeIds, filters);
    }

    // Any other RPC failure: still prefer a working dashboard over a hard crash.
    console.error("[dashboard] stats RPC failed, using scan fallback", error);
    return fetchLeadershipContactStatsViaScan(scopeAll, assigneeIds, filters);
  }

  const raw = (data ?? {}) as RawLeadershipStats;

  return {
    stats: finalizeCampaignStatistics(raw),
    activeCampaigns: asCount(raw.activeCampaigns),
    contactsWithNotesCount: asCount(raw.contactsWithNotes),
  };
}

export async function countContactsWithNotesFast(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  members: TelepastorSummary[],
): Promise<number> {
  const { scopeAll, assigneeIds } = resolveLeadershipContactScope(
    context,
    filters,
    members,
  );

  const contacts = await fetchLeanScopedContacts(scopeAll, assigneeIds, filters);
  return contacts.filter((contact) => Boolean(contact.latest_notes?.trim()))
    .length;
}
