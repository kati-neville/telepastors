import { createClient } from "@/lib/supabase/server";
import type {
  ContactAssignmentHistoryEntry,
  ContactWithAssignee,
  DistributionStats,
  MinistryRole,
  TelepastorSummary,
} from "@/types/domain";
import type { DistributionFilterValues } from "@/lib/validations/assignments";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { getDistributionPoolFilter } from "@/lib/auth/assignments";
import { fetchDistributionPoolContactsForCampaign } from "@/lib/assignments/fetch-distribution-pool";
import { buildContactSearchFilter } from "@/lib/utils/search";

export async function fetchDistributionStats(
  campaignId: string,
  context: AuthorizationContext,
): Promise<DistributionStats> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, assignment_status, current_assignee_id")
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(error.message);
  }

  const contacts = data ?? [];
  const pool = getDistributionPoolFilter(context);
  const poolContacts = await fetchDistributionPoolContactsForCampaign(
    campaignId,
    context,
  );

  return {
    total: contacts.length,
    assigned: contacts.filter((c) => c.assignment_status !== "UNASSIGNED").length,
    unassigned: contacts.filter((c) => c.assignment_status === "UNASSIGNED")
      .length,
    assignedToMe:
      pool === "assigned_to_self"
        ? poolContacts.length
        : contacts.filter((c) => c.assignment_status === "UNASSIGNED").length,
  };
}

export async function fetchDistributionContacts(
  campaignId: string,
  context: AuthorizationContext,
  filters: DistributionFilterValues,
): Promise<ContactWithAssignee[]> {
  const supabase = await createClient();
  const pool = getDistributionPoolFilter(context);

  let query = supabase
    .from("contacts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name", { ascending: true });

  if (pool === "unassigned") {
    if (filters.pool === "unassigned" || filters.pool === "all") {
      if (filters.pool === "unassigned") {
        query = query.eq("assignment_status", "UNASSIGNED");
      }
    } else if (filters.pool === "assigned") {
      query = query.neq("assignment_status", "UNASSIGNED");
    }
  }

  const search = filters.q?.trim();
  if (search) {
    const filter = buildContactSearchFilter(search);
    if (filter) {
      query = query.or(filter);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let contacts = data ?? [];

  if (pool === "assigned_to_self") {
    const poolContacts = await fetchDistributionPoolContactsForCampaign(
      campaignId,
      context,
    );
    const poolIds = new Set(poolContacts.map((contact) => contact.id));
    contacts = contacts.filter((contact) => poolIds.has(contact.id));
  }

  const assigneeIds = [
    ...new Set(
      contacts
        .map((c) => c.current_assignee_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: assignees } = assigneeIds.length
    ? await supabase
        .from("telepastors")
        .select("id, name, role")
        .in("id", assigneeIds)
    : { data: [] };

  const assigneeMap = new Map(
    (assignees ?? []).map((a) => [a.id, { name: a.name, role: a.role }]),
  );

  return contacts.map((contact) => {
    const assignee = contact.current_assignee_id
      ? assigneeMap.get(contact.current_assignee_id)
      : null;

    return {
      ...contact,
      assignee_name: assignee?.name ?? null,
      assignee_role: (assignee?.role as MinistryRole | undefined) ?? null,
    };
  });
}

export async function fetchAssignableMembers(
  context: AuthorizationContext,
): Promise<TelepastorSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id")
    .eq("is_active", true)
    .order("name");

  if (context.telepastor.role === "SUPER_ADMIN") {
    query = query.eq("role", "GOVERNOR");
  } else if (context.telepastor.role === "GOVERNOR") {
    query = query.eq("role", "LEADER").eq("governor_id", context.telepastor.id);
  } else if (context.telepastor.role === "LEADER") {
    query = query.eq("role", "TELEPASTOR").eq("leader_id", context.telepastor.id);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchContactAssignmentHistory(
  contactId: string,
): Promise<ContactAssignmentHistoryEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_assignments")
    .select("*")
    .eq("contact_id", contactId)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const assignments = data ?? [];
  const telepastorIds = [
    ...new Set(
      assignments
        .flatMap((a) => [a.assignee_id, a.assigned_by])
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: telepastors } = telepastorIds.length
    ? await supabase.from("telepastors").select("id, name").in("id", telepastorIds)
    : { data: [] };

  const nameMap = new Map(
    (telepastors ?? []).map((tp) => [tp.id, tp.name]),
  );

  return assignments.map((assignment) => ({
    ...assignment,
    assignee_name: nameMap.get(assignment.assignee_id) ?? "Unknown",
    assigned_by_name: assignment.assigned_by
      ? (nameMap.get(assignment.assigned_by) ?? null)
      : null,
  }));
}

export async function fetchDistributionPoolContactIds(
  campaignId: string,
  context: AuthorizationContext,
): Promise<string[]> {
  const contacts = await fetchDistributionPoolContactsForCampaign(
    campaignId,
    context,
  );

  return contacts.map((contact) => contact.id);
}

export async function fetchContactsByIds(contactIds: string[]) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .in("id", contactIds);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchAssigneeById(assigneeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id, is_active")
    .eq("id", assigneeId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function fetchCampaignsForDistribution(
  context: AuthorizationContext,
) {
  const supabase = await createClient();

  if (context.telepastor.role === "SUPER_ADMIN" || context.telepastor.role === "GOVERNOR") {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("campaign_id")
    .eq("current_assignee_id", context.telepastor.id);

  if (contactsError) throw new Error(contactsError.message);

  const campaignIds = [...new Set((contacts ?? []).map((c) => c.campaign_id))];
  if (campaignIds.length === 0) return [];

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .in("id", campaignIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type DistributionCampaignSummary = {
  id: string;
  name: string;
  readyCount: number;
};

export async function fetchDistributionSummary(
  context: AuthorizationContext,
): Promise<{
  totalReady: number;
  campaigns: DistributionCampaignSummary[];
}> {
  const campaigns = await fetchCampaignsForDistribution(context);

  if (campaigns.length === 0) {
    return { totalReady: 0, campaigns: [] };
  }

  const summaries = await Promise.all(
    campaigns.map(async (campaign) => {
      const poolContacts = await fetchDistributionPoolContactsForCampaign(
        campaign.id,
        context,
      );

      return {
        id: campaign.id,
        name: campaign.name,
        readyCount: poolContacts.length,
      };
    }),
  );

  return {
    totalReady: summaries.reduce((sum, campaign) => sum + campaign.readyCount, 0),
    campaigns: summaries,
  };
}
