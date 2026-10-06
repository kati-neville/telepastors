import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getScopedAssigneeIds } from "@/lib/auth/reports";
import { formatSupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { campaignStatisticsFromCounts } from "@/lib/stats/compute";
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

function asCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    throw new Error(
      formatSupabaseError(error, "Failed to load leadership dashboard stats."),
    );
  }

  const raw = (data ?? {}) as RawLeadershipStats;

  return {
    stats: campaignStatisticsFromCounts(raw),
    activeCampaigns: asCount(raw.activeCampaigns),
    contactsWithNotesCount: asCount(raw.contactsWithNotes),
  };
}

export async function countContactsWithNotesFast(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  members: TelepastorSummary[],
): Promise<number> {
  const result = await fetchLeadershipContactStats(context, filters, members);
  return result.contactsWithNotesCount;
}
