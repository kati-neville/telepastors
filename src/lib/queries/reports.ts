import { createClient } from "@/lib/supabase/server";
import {
  getReportableMembers,
  getReportScopeLabel,
  getScopedAssigneeIds,
  canAccessLeadershipReports,
} from "@/lib/auth/reports";
import { canAccessMyCalls } from "@/lib/auth/permissions";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import {
  computeContactStatistics,
  groupContactsByAssignee,
  type ContactStatRow,
} from "@/lib/stats/compute";
import type {
  FollowUpContact,
  LeadershipDashboardData,
  RecentCallActivity,
  ReportFilterOptions,
  TeamMemberStatistics,
  TeamPerformanceBundle,
  TelepastorSummary,
} from "@/types/domain";
import { memberMatchesPerformanceView } from "@/lib/reports/team-performance-view";
import type { ReportFilterValues } from "@/lib/validations/reports";
import {
  RECENT_ACTIVITY_PAGE_LIMIT,
  RECENT_ACTIVITY_PREVIEW_LIMIT,
} from "@/lib/reports/recent-activity-limit";

type ContactRow = ContactStatRow & { id: string; campaign_id: string };

const CONTACT_ID_BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function throwQueryError(message: string, error: { message?: string | null }) {
  throw new Error(error.message?.trim() || message);
}

function applyAttemptDateFilters<
  T extends {
    gte: (column: string, value: string) => T;
    lte: (column: string, value: string) => T;
  },
>(query: T, filters: ReportFilterValues) {
  let nextQuery = query;

  if (filters.from) {
    nextQuery = nextQuery.gte("attempted_at", filters.from);
  }

  if (filters.to) {
    nextQuery = nextQuery.lte("attempted_at", filters.to);
  }

  return nextQuery;
}

async function fetchAllMembers(): Promise<TelepastorSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchContactsForScope(
  assigneeIds: string[] | null,
  filters: ReportFilterValues,
): Promise<ContactRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "id, campaign_id, latest_response, assignment_status, current_assignee_id",
    );

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

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as ContactRow[];
}

async function fetchUnassignedContacts(filters: ReportFilterValues) {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "id, campaign_id, latest_response, assignment_status, current_assignee_id",
    )
    .is("current_assignee_id", null);

  if (filters.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactRow[];
}

async function countCallAttempts(
  contactIds: string[],
  filters: ReportFilterValues,
) {
  if (contactIds.length === 0) return 0;

  const supabase = await createClient();
  let total = 0;

  for (const batch of chunk(contactIds, CONTACT_ID_BATCH_SIZE)) {
    let query = supabase
      .from("call_attempts")
      .select("*", { count: "exact", head: true })
      .in("contact_id", batch);

    query = applyAttemptDateFilters(query, filters);

    const { count, error } = await query;
    if (error) {
      throwQueryError("Failed to count call attempts.", error);
    }

    total += count ?? 0;
  }

  return total;
}

async function countAttemptsByAssignee(
  contacts: ContactRow[],
  filters: ReportFilterValues,
) {
  const contactIds = contacts.map((contact) => contact.id);
  if (contactIds.length === 0) {
    return {
      counts: new Map<string, number>(),
      lastAttempt: new Map<string, string>(),
    };
  }

  const supabase = await createClient();
  const attempts: Array<{
    contact_id: string;
    telepastor_id: string;
    attempted_at: string;
  }> = [];

  for (const batch of chunk(contactIds, CONTACT_ID_BATCH_SIZE)) {
    let query = supabase
      .from("call_attempts")
      .select("contact_id, telepastor_id, attempted_at")
      .in("contact_id", batch);

    query = applyAttemptDateFilters(query, filters);

    const { data, error } = await query;
    if (error) {
      throwQueryError("Failed to load call attempts by assignee.", error);
    }

    attempts.push(...(data ?? []));
  }

  const contactAssignee = new Map(
    contacts.map((contact) => [contact.id, contact.current_assignee_id]),
  );

  const counts = new Map<string, number>();
  const lastAttempt = new Map<string, string>();

  for (const attempt of attempts) {
    const assigneeId = contactAssignee.get(attempt.contact_id);
    if (!assigneeId) continue;

    counts.set(assigneeId, (counts.get(assigneeId) ?? 0) + 1);

    const previous = lastAttempt.get(assigneeId);
    if (!previous || attempt.attempted_at > previous) {
      lastAttempt.set(assigneeId, attempt.attempted_at);
    }
  }

  return { counts, lastAttempt };
}

async function fetchRecentActivity(
  contacts: Array<{ id: string; campaign_id: string }>,
  filters: ReportFilterValues,
  limit = RECENT_ACTIVITY_PREVIEW_LIMIT,
): Promise<RecentCallActivity[]> {
  if (contacts.length === 0) return [];

  const contactIdSet = new Set(contacts.map((contact) => contact.id));
  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];

  const supabase = await createClient();
  let query = supabase
    .from("call_attempts")
    .select(
      "id, contact_id, campaign_id, telepastor_id, response, notes, attempted_at",
    )
    .in("campaign_id", campaignIds)
    .order("attempted_at", { ascending: false })
    .limit(Math.max(limit * 10, 50));

  query = applyAttemptDateFilters(query, filters);
  if (filters.response) {
    query = query.eq("response", filters.response);
  }
  if (filters.hasNotes) {
    query = query.not("notes", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    throwQueryError("Failed to load recent call activity.", error);
  }

  const attempts = (data ?? [])
    .filter((attempt) => contactIdSet.has(attempt.contact_id))
    .filter((attempt) => !filters.hasNotes || attempt.notes?.trim())
    .slice(0, limit);
  const telepastorIds = [...new Set(attempts.map((a) => a.telepastor_id))];
  const attemptCampaignIds = [...new Set(attempts.map((a) => a.campaign_id))];
  const attemptContactIds = [...new Set(attempts.map((a) => a.contact_id))];

  const [{ data: telepastors }, { data: campaigns }, { data: contactRecords }] =
    await Promise.all([
      telepastorIds.length
        ? supabase.from("telepastors").select("id, name").in("id", telepastorIds)
        : Promise.resolve({ data: [] }),
      attemptCampaignIds.length
        ? supabase.from("campaigns").select("id, name").in("id", attemptCampaignIds)
        : Promise.resolve({ data: [] }),
      attemptContactIds.length
        ? supabase.from("contacts").select("id, name").in("id", attemptContactIds)
        : Promise.resolve({ data: [] }),
    ]);

  const telepastorMap = new Map(
    (telepastors ?? []).map((entry) => [entry.id, entry.name]),
  );
  const campaignMap = new Map(
    (campaigns ?? []).map((entry) => [entry.id, entry.name]),
  );
  const contactMap = new Map(
    (contactRecords ?? []).map((entry) => [entry.id, entry.name]),
  );

  return attempts.map((attempt) => ({
    id: attempt.id,
    contactName: contactMap.get(attempt.contact_id) ?? "Unknown contact",
    telepastorName: telepastorMap.get(attempt.telepastor_id) ?? "Unknown",
    response: attempt.response,
    notes: attempt.notes,
    attemptedAt: attempt.attempted_at,
    campaignName: campaignMap.get(attempt.campaign_id) ?? "Unknown campaign",
  }));
}

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
  const contacts = await fetchContactsWithNotes(context, filters);
  return contacts.length;
}

export async function fetchReportFilterOptions(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<ReportFilterOptions> {
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(context, filters, allMembers);
  return buildFilterOptions(context, scopedMembers);
}

async function buildFilterOptions(
  context: AuthorizationContext,
  members: TelepastorSummary[],
): Promise<ReportFilterOptions> {
  const supabase = await createClient();
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .in("status", ["ACTIVE", "COMPLETED"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

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

function buildTeamPerformance(
  members: TelepastorSummary[],
  contacts: ContactRow[],
  attemptData: {
    counts: Map<string, number>;
    lastAttempt: Map<string, string>;
  },
): TeamMemberStatistics[] {
  const grouped = groupContactsByAssignee(contacts);

  return members
    .map((member) => {
      const memberContacts = grouped.get(member.id) ?? [];
      const memberAttempts = attemptData.counts.get(member.id) ?? 0;

      return {
        memberId: member.id,
        memberName: member.name,
        memberRole: member.role,
        stats: computeContactStatistics(memberContacts, memberAttempts),
        totalCallAttempts: memberAttempts,
        lastAttemptAt: attemptData.lastAttempt.get(member.id) ?? null,
      };
    })
    .filter(
      (entry) =>
        entry.stats.totalContacts > 0 || entry.totalCallAttempts > 0,
    )
    .sort((a, b) => b.stats.completed - a.stats.completed);
}

function stripTeamPerformanceScopeFilters(
  filters: ReportFilterValues,
): ReportFilterValues {
  return {
    ...filters,
    view: undefined,
    governorId: undefined,
    leaderId: undefined,
    telepastorId: undefined,
  };
}

async function buildTeamPerformanceBundle(
  context: AuthorizationContext,
  filters: ReportFilterValues,
): Promise<TeamPerformanceBundle> {
  const bundleFilters = stripTeamPerformanceScopeFilters(filters);
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(
    context,
    bundleFilters,
    allMembers,
  );
  const assigneeIds = getScopedAssigneeIds(scopedMembers);

  let contacts = await fetchContactsForScope(assigneeIds, bundleFilters);

  if (
    context.telepastor.role === "SUPER_ADMIN" &&
    !bundleFilters.governorId &&
    !bundleFilters.leaderId &&
    !bundleFilters.telepastorId
  ) {
    const unassigned = await fetchUnassignedContacts(bundleFilters);
    contacts = [...contacts, ...unassigned];
  }

  const attemptData = await countAttemptsByAssignee(contacts, bundleFilters);
  const performanceMembers = scopedMembers.filter((member) =>
    memberMatchesPerformanceView(member.role, "telepastor") ||
    memberMatchesPerformanceView(member.role, "leader"),
  );

  const memberRows = buildTeamPerformance(
    performanceMembers,
    contacts,
    attemptData,
  );

  const governorRows =
    context.telepastor.role === "SUPER_ADMIN"
      ? buildGovernorPerformance(allMembers, contacts, attemptData)
      : [];

  return {
    governorRows,
    memberRows,
    members: scopedMembers,
  };
}

export async function fetchLeadershipDashboard(
  context: AuthorizationContext,
  filters: ReportFilterValues = {},
): Promise<LeadershipDashboardData> {
  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(
    context,
    filters,
    allMembers,
  );
  const assigneeIds = getScopedAssigneeIds(scopedMembers);

  let contacts = await fetchContactsForScope(assigneeIds, filters);

  if (context.telepastor.role === "SUPER_ADMIN" && !filters.governorId && !filters.leaderId && !filters.telepastorId) {
    const unassigned = await fetchUnassignedContacts(filters);
    contacts = [...contacts, ...unassigned];
  }

  const contactIds = contacts.map((contact) => contact.id);
  const totalCallAttempts = await countCallAttempts(contactIds, filters);
  const stats = computeContactStatistics(contacts, totalCallAttempts);

  const activeCampaigns = await countActiveCampaignsInScope(
    context,
    contacts,
    filters,
  );

  const [teamPerformanceBundle, recentActivity, contactsWithNotesCount, filterOptions] =
    await Promise.all([
      buildTeamPerformanceBundle(context, filters),
      fetchRecentActivity(
        contacts,
        filters,
        RECENT_ACTIVITY_PREVIEW_LIMIT,
      ),
      countContactsWithNotes(context, filters),
      buildFilterOptions(context, scopedMembers),
    ]);

  return {
    scopeLabel: getReportScopeLabel(context.telepastor.role),
    stats,
    activeCampaigns,
    contactsWithNotesCount,
    teamPerformanceBundle,
    recentActivity,
    filterOptions,
  };
}

async function countActiveCampaignsInScope(
  context: AuthorizationContext,
  contacts: ContactRow[],
  filters: ReportFilterValues,
) {
  const supabase = await createClient();

  if (context.telepastor.role === "SUPER_ADMIN") {
    let query = supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE");

    if (filters.campaignId) {
      query = query.eq("id", filters.campaignId);
    }

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  const scopedCampaignIds = [
    ...new Set(contacts.map((contact) => contact.campaign_id)),
  ];

  if (scopedCampaignIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("status", "ACTIVE")
    .in("id", scopedCampaignIds);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

function buildGovernorPerformance(
  allMembers: TelepastorSummary[],
  contacts: ContactRow[],
  attemptData: {
    counts: Map<string, number>;
    lastAttempt: Map<string, string>;
  },
): TeamMemberStatistics[] {
  const governors = allMembers.filter((member) => member.role === "GOVERNOR");
  const memberById = new Map(allMembers.map((member) => [member.id, member]));

  return governors
    .map((governor) => {
      const orgMemberIds = new Set(
        allMembers
          .filter((member) => {
            if (member.id === governor.id) return true;
            if (member.role === "LEADER" && member.governor_id === governor.id) {
              return true;
            }
            if (member.role === "TELEPASTOR") {
              const leader = member.leader_id
                ? memberById.get(member.leader_id)
                : null;
              return (
                getGovernorIdForTelepastor(member, leader) === governor.id
              );
            }
            return false;
          })
          .map((member) => member.id),
      );

      const governorContacts = contacts.filter(
        (contact) =>
          contact.current_assignee_id &&
          orgMemberIds.has(contact.current_assignee_id),
      );

      let totalAttempts = 0;
      let lastAttemptAt: string | null = null;

      for (const memberId of orgMemberIds) {
        totalAttempts += attemptData.counts.get(memberId) ?? 0;
        const memberLast = attemptData.lastAttempt.get(memberId);
        if (memberLast && (!lastAttemptAt || memberLast > lastAttemptAt)) {
          lastAttemptAt = memberLast;
        }
      }

      return {
        memberId: governor.id,
        memberName: governor.name,
        memberRole: governor.role,
        stats: computeContactStatistics(governorContacts, totalAttempts),
        totalCallAttempts: totalAttempts,
        lastAttemptAt,
      };
    })
    .filter(
      (entry) =>
        entry.stats.totalContacts > 0 || entry.totalCallAttempts > 0,
    )
    .sort((a, b) => b.stats.completed - a.stats.completed);
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

  const allMembers = await fetchAllMembers();
  const scopedMembers = getReportableMembers(context, filters, allMembers);
  const assigneeIds = getScopedAssigneeIds(scopedMembers);

  let contacts = await fetchContactsForScope(assigneeIds, filters);

  if (
    context.telepastor.role === "SUPER_ADMIN" &&
    !filters.governorId &&
    !filters.leaderId &&
    !filters.telepastorId
  ) {
    const unassigned = await fetchUnassignedContacts(filters);
    contacts = [...contacts, ...unassigned];
  }

  return fetchRecentActivity(contacts, filters, limit);
}

export async function fetchTelepastorRecentActivity(
  telepastorId: string,
  limit = RECENT_ACTIVITY_PREVIEW_LIMIT,
): Promise<RecentCallActivity[]> {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, campaign_id")
    .eq("current_assignee_id", telepastorId);

  return fetchRecentActivity(contacts ?? [], {}, limit);
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
