import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getReportableMembers,
  getReportScopeLabel,
  getScopedAssigneeIds,
  canAccessLeadershipReports,
} from "@/lib/auth/reports";
import { canAccessMyCalls } from "@/lib/auth/permissions";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { formatSupabaseError } from "@/lib/supabase/errors";
import { fetchMyCallSummary } from "@/lib/queries/calls";
import { campaignStatisticsFromCounts } from "@/lib/stats/compute";
import {
  CALL_RESPONSES,
  MINISTRY_ROLES,
  type CallResponse,
  type CampaignStatistics,
  type FollowUpContact,
  type MinistryRole,
  type RecentCallActivity,
  type ReportFilterOptions,
  type TeamMemberStatistics,
  type TeamPerformanceBundle,
  type TelepastorSummary,
} from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";
import {
  RECENT_ACTIVITY_PAGE_LIMIT,
  RECENT_ACTIVITY_PREVIEW_LIMIT,
} from "@/lib/reports/recent-activity-limit";
import {
  countContactsWithNotesFast,
  fetchLeadershipContactStats,
  resolveLeadershipContactScope,
} from "@/lib/queries/leadership-dashboard-stats";

type RawTeamPerformanceRow = {
  memberId?: string;
  memberName?: string;
  memberRole?: string;
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
  lastAttemptAt?: string | null;
};

type RawTeamPerformancePayload = {
  memberRows?: RawTeamPerformanceRow[];
  governorRows?: RawTeamPerformanceRow[];
};

type RawRecentActivityRow = {
  id?: string;
  contactName?: string;
  telepastorName?: string;
  response?: string;
  notes?: string | null;
  attemptedAt?: string;
  campaignName?: string;
};

export const fetchAllMembers = cache(async (): Promise<TelepastorSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
});

async function fetchFollowUpContacts(
  assigneeIds: string[] | null,
  filters: ReportFilterValues,
  limit = 50,
): Promise<FollowUpContact[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "id, name, phone, phone_normalized, campaign_id, latest_response, latest_notes, latest_response_at, current_assignee_id, latest_recorded_by",
    )
    .not("latest_notes", "is", null)
    .order("latest_response_at", { ascending: false })
    .limit(limit);

  if (assigneeIds && assigneeIds.length > 0) {
    query = query.in("current_assignee_id", assigneeIds);
  } else if (assigneeIds && assigneeIds.length === 0) {
    return [];
  }

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

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const contacts = (data ?? []).filter(
    (contact) => contact.latest_notes && contact.latest_notes.trim().length > 0,
  );

  if (contacts.length === 0) {
    return [];
  }

  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];
  const assigneeIdsFromContacts = [
    ...new Set(
      contacts
        .map((contact) => contact.current_assignee_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const recorderIds = [
    ...new Set(
      contacts
        .map((contact) => contact.latest_recorded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const telepastorLookupIds = [
    ...new Set([...assigneeIdsFromContacts, ...recorderIds]),
  ];

  const [{ data: campaigns }, { data: telepastors }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
      : Promise.resolve({ data: [] }),
    telepastorLookupIds.length
      ? supabase
          .from("telepastors")
          .select("id, name")
          .in("id", telepastorLookupIds)
      : Promise.resolve({ data: [] }),
  ]);

  const campaignMap = new Map(
    (campaigns ?? []).map((entry) => [entry.id, entry.name]),
  );
  const telepastorMap = new Map(
    (telepastors ?? []).map((entry) => [entry.id, entry.name]),
  );

  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    phoneNormalized: contact.phone_normalized,
    currentAssigneeId: contact.current_assignee_id,
    campaignName: campaignMap.get(contact.campaign_id) ?? "Unknown campaign",
    latestResponse: contact.latest_response,
    latestNotes: contact.latest_notes!.trim(),
    latestResponseAt: contact.latest_response_at,
    assigneeName: contact.current_assignee_id
      ? (telepastorMap.get(contact.current_assignee_id) ?? "Unassigned")
      : "Unassigned",
    recordedByName: contact.latest_recorded_by
      ? (telepastorMap.get(contact.latest_recorded_by) ?? "Unknown")
      : "Unknown",
  }));
}

export async function fetchContactsWithNotes(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<FollowUpContact[]> {
  if (canAccessLeadershipReports(context)) {
    const allMembers = await fetchAllMembers();
    const scopedMembers = getReportableMembers(context, filters, allMembers);
    const assigneeIds = getScopedAssigneeIds(scopedMembers);
    return fetchFollowUpContacts(assigneeIds, filters, 10_000);
  }

  if (canAccessMyCalls(context)) {
    return fetchFollowUpContacts([context.telepastor.id], filters, 10_000);
  }

  return [];
}

export async function countContactsWithNotes(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<number> {
  if (canAccessLeadershipReports(context)) {
    const allMembers = await fetchAllMembers();
    const scopedMembers = getReportableMembers(context, filters, allMembers);
    return countContactsWithNotesFast(context, filters, scopedMembers);
  }

  if (canAccessMyCalls(context)) {
    // Unfiltered count (dashboard card) is a single aggregate RPC.
    if (!filters.campaignId && !filters.response) {
      return (await fetchMyCallSummary()).contactsWithNotes;
    }

    const supabase = await createClient();
    let query = supabase
      .from("contacts")
      .select("latest_notes")
      .eq("current_assignee_id", context.telepastor.id)
      .not("latest_notes", "is", null);

    if (filters.campaignId) {
      query = query.eq("campaign_id", filters.campaignId);
    }
    if (filters.response) {
      query = query.eq("latest_response", filters.response);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(
        formatSupabaseError(error, "Failed to count contacts with notes."),
      );
    }

    return (data ?? []).filter((row) => Boolean(row.latest_notes?.trim())).length;
  }

  return 0;
}

export async function fetchReportFilterOptions(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<ReportFilterOptions> {
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(context, filters, allMembers);
  return buildFilterOptions(context, scopedMembers);
}

// Per-request dedupe only: the query runs on the caller's RLS-scoped client,
// so it must never be shared across users/requests.
const fetchFilterCampaigns = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .in("status", ["ACTIVE", "COMPLETED"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

async function buildFilterOptions(
  context: AuthorizationContext,
  members: TelepastorSummary[],
): Promise<ReportFilterOptions> {
  const campaigns = await fetchFilterCampaigns();

  const governors = members.filter((member) => member.role === "GOVERNOR");
  const leaders = members.filter((member) => member.role === "LEADER");
  const telepastors = members.filter((member) => member.role === "TELEPASTOR");

  if (context.telepastor.role === "SUPER_ADMIN") {
    const allMembers = await fetchAllMembers();
    return {
      campaigns: campaigns ?? [],
      governors: allMembers.filter((member) => member.role === "GOVERNOR"),
      leaders: allMembers.filter((member) => member.role === "LEADER"),
      telepastors: allMembers.filter((member) => member.role === "TELEPASTOR"),
    };
  }

  return {
    campaigns: campaigns ?? [],
    governors,
    leaders,
    telepastors,
  };
}

function asMinistryRole(value: string | undefined): MinistryRole {
  if (value && MINISTRY_ROLES.includes(value as MinistryRole)) {
    return value as MinistryRole;
  }
  return "TELEPASTOR";
}

function asCallResponse(value: string | undefined): CallResponse {
  if (value && (CALL_RESPONSES as readonly string[]).includes(value)) {
    return value as CallResponse;
  }
  return "OTHER";
}

function mapTeamPerformanceRow(raw: RawTeamPerformanceRow): TeamMemberStatistics {
  const stats = campaignStatisticsFromCounts(raw);
  return {
    memberId: raw.memberId ?? "",
    memberName: raw.memberName ?? "Unknown",
    memberRole: asMinistryRole(raw.memberRole),
    stats,
    totalCallAttempts: stats.totalCallAttempts,
    lastAttemptAt: raw.lastAttemptAt ?? null,
  };
}

function mapRecentActivityRow(raw: RawRecentActivityRow): RecentCallActivity {
  return {
    id: raw.id ?? "",
    contactName: raw.contactName ?? "Unknown contact",
    telepastorName: raw.telepastorName ?? "Unknown",
    response: asCallResponse(raw.response),
    notes: raw.notes ?? null,
    attemptedAt: raw.attemptedAt ?? "",
    campaignName: raw.campaignName ?? "Unknown campaign",
  };
}

async function resolveReportRpcScope(
  context: AuthorizationContext,
  filters: ReportFilterValues,
) {
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(context, filters, allMembers);
  const { scopeAll, assigneeIds } = resolveLeadershipContactScope(
    context,
    filters,
    scopedMembers,
  );

  return { scopedMembers, scopeAll, assigneeIds };
}

export type LeadershipDashboardShellData = {
  scopeLabel: string;
  stats: CampaignStatistics;
  activeCampaigns: number;
  contactsWithNotesCount: number;
  filterOptions: ReportFilterOptions;
};

export async function fetchLeadershipDashboardShell(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<LeadershipDashboardShellData> {
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(context, filters, allMembers);
  const optionMembers = getReportableMembers(context, {}, allMembers);

  const [contactStats, filterOptions] = await Promise.all([
    fetchLeadershipContactStats(context, filters, scopedMembers),
    buildFilterOptions(context, optionMembers),
  ]);

  return {
    scopeLabel: getReportScopeLabel(context.telepastor.role),
    stats: contactStats.stats,
    activeCampaigns: contactStats.activeCampaigns,
    contactsWithNotesCount: contactStats.contactsWithNotesCount,
    filterOptions,
  };
}

export async function fetchTeamPerformanceBundle(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<TeamPerformanceBundle> {
  const { scopedMembers, scopeAll, assigneeIds } = await resolveReportRpcScope(
    context,
    filters,
  );

  const empty: TeamPerformanceBundle = {
    governorRows: [],
    memberRows: [],
    members: scopedMembers,
  };

  if (!scopeAll && assigneeIds.length === 0) {
    return empty;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_report_team_performance", {
    p_assignee_ids: scopeAll ? null : assigneeIds,
    p_scope_all: scopeAll,
    p_campaign_id: filters.campaignId ?? null,
    p_response: filters.response ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
  });

  if (error) {
    throw new Error(
      formatSupabaseError(error, "Failed to load team performance."),
    );
  }

  const payload = (data ?? {}) as RawTeamPerformancePayload;
  const memberRows = (payload.memberRows ?? [])
    .map(mapTeamPerformanceRow)
    .filter((row) => row.memberId);
  const governorRows =
    context.telepastor.role === "SUPER_ADMIN"
      ? (payload.governorRows ?? [])
          .map(mapTeamPerformanceRow)
          .filter((row) => row.memberId)
      : [];

  return {
    governorRows,
    memberRows,
    members: scopedMembers,
  };
}

export async function fetchLeadershipRecentActivity(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
  limit = RECENT_ACTIVITY_PREVIEW_LIMIT,
): Promise<RecentCallActivity[]> {
  const { scopeAll, assigneeIds } = await resolveReportRpcScope(
    context,
    filters,
  );

  if (!scopeAll && assigneeIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_report_recent_activity", {
    p_assignee_ids: scopeAll ? null : assigneeIds,
    p_scope_all: scopeAll,
    p_campaign_id: filters.campaignId ?? null,
    p_response: filters.response ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_has_notes: filters.hasNotes === "true",
    p_limit: limit,
  });

  if (error) {
    throw new Error(
      formatSupabaseError(error, "Failed to load recent call activity."),
    );
  }

  return ((data ?? []) as RawRecentActivityRow[])
    .map(mapRecentActivityRow)
    .filter((row) => row.id);
}

export async function fetchRecentActivityForContext(
  context: AuthorizationContext,
  filters: ReportFilterValues,
  limit = RECENT_ACTIVITY_PAGE_LIMIT,
): Promise<RecentCallActivity[]> {
  if (context.telepastor.role === "TELEPASTOR") {
    return fetchTelepastorRecentActivity(context.telepastor.id, limit);
  }

  if (!canAccessLeadershipReports(context)) {
    return [];
  }

  return fetchLeadershipRecentActivity(context, filters, limit);
}

export async function fetchTelepastorRecentActivity(
  telepastorId: string,
  limit = RECENT_ACTIVITY_PREVIEW_LIMIT,
): Promise<RecentCallActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_report_recent_activity", {
    p_assignee_ids: [telepastorId],
    p_scope_all: false,
    p_campaign_id: null,
    p_response: null,
    p_from: null,
    p_to: null,
    p_has_notes: false,
    p_limit: limit,
  });

  if (error) {
    throw new Error(
      formatSupabaseError(error, "Failed to load recent call activity."),
    );
  }

  return ((data ?? []) as RawRecentActivityRow[])
    .map(mapRecentActivityRow)
    .filter((row) => row.id);
}

export function buildTeamPerformanceCsv(rows: TeamMemberStatistics[]) {
  const escape = (value: string | number) => {
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const header = [
    "Name",
    "Role",
    "Assigned",
    "Completed",
    "Remaining",
    "Coming",
    "Not Coming",
    "Unreachable",
    "Switched Off",
    "Wrong Number",
    "Other",
    "Call Attempts",
    "Completion %",
    "Reach Rate %",
    "Coming %",
  ];

  const lines = rows.map((row) =>
    [
      row.memberName,
      row.memberRole,
      row.stats.totalContacts,
      row.stats.completed,
      row.stats.remaining,
      row.stats.coming,
      row.stats.notComing,
      row.stats.unreachable,
      row.stats.switchedOff,
      row.stats.wrongNumber,
      row.stats.other,
      row.totalCallAttempts,
      row.stats.completionPercentage,
      row.stats.reachRate,
      row.stats.comingPercentage,
    ]
      .map(escape)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}
