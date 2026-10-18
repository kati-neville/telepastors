import { formatSupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import type {
  CallAttempt,
  CallQueueContact,
  CallResponse,
  Contact,
} from "@/types/domain";

const PENDING_PAGE_SIZE = 80;
const QUEUE_WINDOW_MAX = 10;
const ATTEMPT_ID_BATCH_SIZE = 200;

export type NextQueueContactRef = {
  id: string;
  attempt_count: number;
};

export type FetchNextQueueContactsOptions = {
  campaignId?: string;
  skipContactIds?: string[];
  limit?: number;
};

function chunkIds(ids: string[], size: number) {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    batches.push(ids.slice(index, index + size));
  }
  return batches;
}

function clampQueueLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 2;
  }

  return Math.min(QUEUE_WINDOW_MAX, Math.max(1, Math.floor(limit)));
}

function shouldFallbackFromNextQueueRpc(error: {
  code?: string;
  message?: string;
  status?: number;
}): boolean {
  const message = error.message ?? "";

  return (
    error.code === "PGRST202" ||
    error.code === "PGRST203" ||
    error.status === 400 ||
    /bad request/i.test(message) ||
    message.includes("get_next_queue_contact_ids")
  );
}

async function fetchAttemptCounts(
  contactIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (contactIds.length === 0) {
    return counts;
  }

  const supabase = await createClient();

  for (const batch of chunkIds(contactIds, ATTEMPT_ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("call_attempts")
      .select("contact_id")
      .in("contact_id", batch);

    if (error) {
      throw new Error(
        formatSupabaseError(error, "Failed to count previous call attempts."),
      );
    }

    for (const row of data ?? []) {
      counts.set(row.contact_id, (counts.get(row.contact_id) ?? 0) + 1);
    }
  }

  return counts;
}

async function fetchNextQueueContactIdsFallback(
  telepastorId: string,
  options: {
    campaignId?: string;
    skipContactIds: string[];
    limit: number;
  },
): Promise<NextQueueContactRef[]> {
  const supabase = await createClient();
  const skip = new Set(options.skipContactIds);
  const uncalled: NextQueueContactRef[] = [];
  const retried: Array<NextQueueContactRef & { name: string }> = [];
  let from = 0;

  while (uncalled.length < options.limit) {
    let query = supabase
      .from("contacts")
      .select("id, name")
      .eq("current_assignee_id", telepastorId)
      .is("latest_response", null)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PENDING_PAGE_SIZE - 1);

    if (options.campaignId) {
      query = query.eq("campaign_id", options.campaignId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        formatSupabaseError(error, "Failed to load the next contacts to call."),
      );
    }

    const page = data ?? [];
    const pageIds = page.map((row) => row.id).filter((id) => !skip.has(id));
    const attemptCounts = await fetchAttemptCounts(pageIds);

    for (const row of page) {
      if (skip.has(row.id)) {
        continue;
      }

      const attemptCount = attemptCounts.get(row.id) ?? 0;
      if (attemptCount === 0) {
        uncalled.push({ id: row.id, attempt_count: 0 });
        continue;
      }

      retried.push({
        id: row.id,
        name: row.name,
        attempt_count: attemptCount,
      });
    }

    if (page.length < PENDING_PAGE_SIZE) {
      break;
    }

    from += PENDING_PAGE_SIZE;
  }

  if (uncalled.length >= options.limit) {
    return uncalled.slice(0, options.limit);
  }

  retried.sort((left, right) => {
    if (left.attempt_count !== right.attempt_count) {
      return left.attempt_count - right.attempt_count;
    }

    const byName = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });

  return [
    ...uncalled,
    ...retried.map(({ id, attempt_count }) => ({ id, attempt_count })),
  ].slice(0, options.limit);
}

export async function fetchNextQueueContactRefs(
  context: AuthorizationContext,
  options: FetchNextQueueContactsOptions = {},
): Promise<NextQueueContactRef[]> {
  const limit = clampQueueLimit(options.limit);
  const skipContactIds = options.skipContactIds ?? [];
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_next_queue_contact_ids", {
    p_campaign_id: options.campaignId ?? null,
    p_skip_ids: skipContactIds,
    p_limit: limit,
  });

  if (!error) {
    return (data ?? []).map((row) => ({
      id: row.contact_id,
      attempt_count: row.attempt_count,
    }));
  }

  if (!shouldFallbackFromNextQueueRpc(error)) {
    throw new Error(
      formatSupabaseError(error, "Failed to load the next contacts to call."),
    );
  }

  return fetchNextQueueContactIdsFallback(context.telepastor.id, {
    campaignId: options.campaignId,
    skipContactIds,
    limit,
  });
}

export async function hydrateQueueContacts(
  refs: NextQueueContactRef[],
): Promise<CallQueueContact[]> {
  if (refs.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const ids = refs.map((ref) => ref.id);
  const attemptCountById = new Map(
    refs.map((ref) => [ref.id, ref.attempt_count]),
  );

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*")
    .in("id", ids);

  if (contactsError) {
    throw new Error(
      formatSupabaseError(contactsError, "Failed to load queue contacts."),
    );
  }

  const contactRows = (contacts ?? []) as Contact[];
  const contactById = new Map(
    contactRows.map((contact) => [contact.id, contact]),
  );
  const campaignIds = [
    ...new Set(contactRows.map((contact) => contact.campaign_id)),
  ];
  const retriedIds = refs
    .filter((ref) => ref.attempt_count > 0)
    .map((ref) => ref.id);

  const [campaignsResult, attempts] = await Promise.all([
    campaignIds.length
      ? supabase
          .from("campaigns")
          .select("id, name, call_script")
          .in("id", campaignIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            call_script: string | null;
          }>,
          error: null,
        }),
    retriedIds.length > 0
      ? fetchAttemptsForContacts(retriedIds)
      : Promise.resolve([] as CallAttempt[]),
  ]);

  if (campaignsResult.error) {
    throw new Error(
      formatSupabaseError(
        campaignsResult.error,
        "Failed to load campaign details for the call queue.",
      ),
    );
  }

  const campaignMap = new Map(
    (campaignsResult.data ?? []).map((campaign) => [
      campaign.id,
      {
        name: campaign.name,
        call_script: campaign.call_script,
      },
    ]),
  );

  const attemptsByContact = new Map<string, CallAttempt[]>();
  for (const attempt of attempts) {
    const list = attemptsByContact.get(attempt.contact_id) ?? [];
    list.push(attempt);
    attemptsByContact.set(attempt.contact_id, list);
  }

  return refs.flatMap((ref) => {
    const contact = contactById.get(ref.id);
    if (!contact) {
      return [];
    }

    const campaign = campaignMap.get(contact.campaign_id);
    const priorAttempts = attemptsByContact.get(contact.id) ?? [];

    return [
      {
        ...contact,
        latest_response: contact.latest_response as CallResponse | null,
        campaign_name: campaign?.name ?? "Unknown campaign",
        campaign_call_script: campaign?.call_script ?? null,
        attempt_count: attemptCountById.get(contact.id) ?? priorAttempts.length,
        prior_attempts: priorAttempts,
      },
    ];
  });
}

async function fetchAttemptsForContacts(
  contactIds: string[],
): Promise<CallAttempt[]> {
  const supabase = await createClient();
  const attempts: CallAttempt[] = [];

  for (const batch of chunkIds(contactIds, ATTEMPT_ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("call_attempts")
      .select("*")
      .in("contact_id", batch)
      .order("attempted_at", { ascending: false });

    if (error) {
      throw new Error(
        formatSupabaseError(error, "Failed to load previous call attempts."),
      );
    }

    attempts.push(...((data ?? []) as CallAttempt[]));
  }

  return attempts;
}

export async function fetchNextQueueContacts(
  context: AuthorizationContext,
  options: FetchNextQueueContactsOptions = {},
): Promise<CallQueueContact[]> {
  const refs = await fetchNextQueueContactRefs(context, options);
  return hydrateQueueContacts(refs);
}
