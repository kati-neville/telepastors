import { createClient } from "@/lib/supabase/server";
import { buildContactSearchFilter } from "@/lib/utils/search";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import type {
  AssignedContact,
  CallAttempt,
  CallQueueContact,
  CallQueueStats,
  CallResponse,
} from "@/types/domain";
import type { AssignedContactsFilterValues } from "@/lib/validations/calls";

function emptyStats(): CallQueueStats {
  return {
    assigned: 0,
    completed: 0,
    remaining: 0,
    coming: 0,
    notComing: 0,
    unreachable: 0,
    wrongNumber: 0,
    other: 0,
  };
}

function buildStats(contacts: AssignedContact[]): CallQueueStats {
  const stats = emptyStats();
  stats.assigned = contacts.length;

  for (const contact of contacts) {
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

  return stats;
}

async function fetchAssignedContactRows(
  telepastorId: string,
  filters?: AssignedContactsFilterValues,
) {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("*")
    .eq("current_assignee_id", telepastorId)
    .order("name", { ascending: true });

  if (filters?.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }

  const search = filters?.q?.trim();
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

  return data ?? [];
}

async function enrichAssignedContacts(
  contacts: Awaited<ReturnType<typeof fetchAssignedContactRows>>,
): Promise<AssignedContact[]> {
  if (contacts.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];
  const contactIds = contacts.map((contact) => contact.id);

  const [{ data: campaigns }, { data: attempts }] = await Promise.all([
    supabase.from("campaigns").select("id, name").in("id", campaignIds),
    supabase
      .from("call_attempts")
      .select("contact_id")
      .in("contact_id", contactIds),
  ]);

  const campaignMap = new Map(
    (campaigns ?? []).map((campaign) => [campaign.id, campaign.name]),
  );

  const attemptCountMap = new Map<string, number>();
  for (const attempt of attempts ?? []) {
    attemptCountMap.set(
      attempt.contact_id,
      (attemptCountMap.get(attempt.contact_id) ?? 0) + 1,
    );
  }

  return contacts.map((contact) => ({
    ...contact,
    latest_response: contact.latest_response as CallResponse | null,
    campaign_name: campaignMap.get(contact.campaign_id) ?? "Unknown campaign",
    attempt_count: attemptCountMap.get(contact.id) ?? 0,
  }));
}

export async function fetchCallQueueStats(
  context: AuthorizationContext,
): Promise<CallQueueStats> {
  const contacts = await enrichAssignedContacts(
    await fetchAssignedContactRows(context.telepastor.id),
  );

  return buildStats(contacts);
}

export async function fetchAssignedContacts(
  context: AuthorizationContext,
  filters: AssignedContactsFilterValues = {},
): Promise<AssignedContact[]> {
  return enrichAssignedContacts(
    await fetchAssignedContactRows(context.telepastor.id, filters),
  );
}

export async function fetchAssignedContactById(
  context: AuthorizationContext,
  contactId: string,
): Promise<AssignedContact | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("current_assignee_id", context.telepastor.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [contact] = await enrichAssignedContacts([data]);
  return contact ?? null;
}

export async function fetchCallAttemptsForContact(
  contactId: string,
): Promise<CallAttempt[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("contact_id", contactId)
    .order("attempted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CallAttempt[];
}

export async function fetchNextQueueContact(
  context: AuthorizationContext,
  options?: {
    campaignId?: string;
    skipContactIds?: string[];
    startFromContactId?: string;
  },
): Promise<CallQueueContact | null> {
  const contacts = await fetchAssignedContacts(context, {
    campaignId: options?.campaignId,
  });

  const skipSet = new Set(options?.skipContactIds ?? []);
  const pending = contacts.filter(
    (contact) => !contact.latest_response && !skipSet.has(contact.id),
  );

  if (pending.length === 0) {
    return null;
  }

  let nextContact = pending[0]!;

  if (options?.startFromContactId) {
    const startIndex = pending.findIndex(
      (contact) => contact.id === options.startFromContactId,
    );

    if (startIndex >= 0) {
      nextContact = pending[startIndex]!;
    }
  }

  const priorAttempts = await fetchCallAttemptsForContact(nextContact.id);

  return {
    ...nextContact,
    prior_attempts: priorAttempts,
  };
}

export async function fetchCallQueueContact(
  context: AuthorizationContext,
  contactId: string,
): Promise<CallQueueContact | null> {
  const contact = await fetchAssignedContactById(context, contactId);

  if (!contact) {
    return null;
  }

  const priorAttempts = await fetchCallAttemptsForContact(contact.id);

  return {
    ...contact,
    prior_attempts: priorAttempts,
  };
}

export async function fetchActiveCampaignsForTelepastor(
  context: AuthorizationContext,
) {
  const contacts = await fetchAssignedContacts(context);
  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];

  if (campaignIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status")
    .in("id", campaignIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
