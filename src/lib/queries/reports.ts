import { createClient } from "@/lib/supabase/server";
import {
  getReportableMembers,
  getReportScopeLabel,
  getScopedAssigneeIds,
} from "@/lib/auth/reports";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import {
  computeContactStatistics,
  groupContactsByAssignee,
  type ContactStatRow,
} from "@/lib/stats/compute";
import type {
  LeadershipDashboardData,
  RecentCallActivity,
  ReportFilterOptions,
  TeamMemberStatistics,
  TelepastorSummary,
} from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

type ContactRow = ContactStatRow & { id: string; campaign_id: string };

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
  let query = supabase
    .from("call_attempts")
    .select("*", { count: "exact", head: true })
    .in("contact_id", contactIds);

  if (filters.from) {
    query = query.gte("attempted_at", filters.from);
  }

  if (filters.to) {
    query = query.lte("attempted_at", filters.to);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
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
  let query = supabase
    .from("call_attempts")
    .select("contact_id, telepastor_id, attempted_at")
    .in("contact_id", contactIds);

  if (filters.from) query = query.gte("attempted_at", filters.from);
  if (filters.to) query = query.lte("attempted_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const contactAssignee = new Map(
    contacts.map((contact) => [contact.id, contact.current_assignee_id]),
  );

  const counts = new Map<string, number>();
  const lastAttempt = new Map<string, string>();

  for (const attempt of data ?? []) {
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
  contactIds: string[],
  filters: ReportFilterValues,
  limit = 8,
): Promise<RecentCallActivity[]> {
  if (contactIds.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("call_attempts")
    .select("id, contact_id, campaign_id, telepastor_id, response, attempted_at")
    .in("contact_id", contactIds)
    .order("attempted_at", { ascending: false })
    .limit(limit);

  if (filters.from) query = query.gte("attempted_at", filters.from);
  if (filters.to) query = query.lte("attempted_at", filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const attempts = data ?? [];
  const telepastorIds = [...new Set(attempts.map((a) => a.telepastor_id))];
  const campaignIds = [...new Set(attempts.map((a) => a.campaign_id))];
  const attemptContactIds = [...new Set(attempts.map((a) => a.contact_id))];

  const [{ data: telepastors }, { data: campaigns }, { data: contacts }] =
    await Promise.all([
      telepastorIds.length
        ? supabase.from("telepastors").select("id, name").in("id", telepastorIds)
        : Promise.resolve({ data: [] }),
      campaignIds.length
        ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
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
    (contacts ?? []).map((entry) => [entry.id, entry.name]),
  );

  return attempts.map((attempt) => ({
    id: attempt.id,
    contactName: contactMap.get(attempt.contact_id) ?? "Unknown contact",
    telepastorName: telepastorMap.get(attempt.telepastor_id) ?? "Unknown",
    response: attempt.response,
    attemptedAt: attempt.attempted_at,
    campaignName: campaignMap.get(attempt.campaign_id) ?? "Unknown campaign",
  }));
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
  const attemptData = await countAttemptsByAssignee(contacts, filters);

  const activeCampaigns = await countActiveCampaignsInScope(
    context,
    contacts,
    filters,
  );

  const performanceMembers =
    context.telepastor.role === "SUPER_ADMIN"
      ? allMembers.filter((member) => member.role === "GOVERNOR")
      : context.telepastor.role === "GOVERNOR"
        ? scopedMembers.filter(
            (member) =>
              member.role === "LEADER" || member.role === "TELEPASTOR",
          )
        : scopedMembers.filter((member) => member.role === "TELEPASTOR");

  let teamPerformance = buildTeamPerformance(
    performanceMembers,
    contacts,
    attemptData,
  );

  if (context.telepastor.role === "SUPER_ADMIN") {
    teamPerformance = buildGovernorPerformance(allMembers, contacts, attemptData);
  }

  const recentActivity = await fetchRecentActivity(contactIds, filters);
  const filterOptions = await buildFilterOptions(context, scopedMembers);

  return {
    scopeLabel: getReportScopeLabel(context.telepastor.role),
    stats,
    activeCampaigns,
    teamPerformance,
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

export async function fetchTelepastorRecentActivity(
  telepastorId: string,
  limit = 5,
): Promise<RecentCallActivity[]> {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("current_assignee_id", telepastorId);

  const contactIds = (contacts ?? []).map((contact) => contact.id);
  return fetchRecentActivity(contactIds, {}, limit);
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
