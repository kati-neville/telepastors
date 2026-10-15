import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database";

const CLASSIFY_RPC_CHUNK_SIZE = 200;
const CLASSIFY_TABLE_CHUNK_SIZE = 20;

export type CalledStatusRow = {
  contactId: string;
  currentAssigneeId: string | null;
  isCalled: boolean;
};

export type CalledPartition = {
  uncalledIds: string[];
  calledIds: string[];
};

export type UndoAssigneePreviewCounts = {
  noAttemptsCount: number;
  withAttemptsCount: number;
  alreadyMovedCount: number;
};

type AttemptRow = {
  contact_id: string;
  assignment_id: string | null;
  telepastor_id: string;
};

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

export function isContactCalledForCurrentWork(
  contact: {
    latest_response: string | null;
    current_assignment_id: string | null;
    current_assignee_id: string | null;
  },
  attempts: Array<{ assignment_id: string | null; telepastor_id: string }>,
): boolean {
  if (contact.latest_response) {
    return true;
  }

  if (!contact.current_assignment_id && !contact.current_assignee_id) {
    return attempts.length > 0;
  }

  return attempts.some(
    (attempt) =>
      (Boolean(contact.current_assignment_id) &&
        attempt.assignment_id === contact.current_assignment_id) ||
      (Boolean(contact.current_assignee_id) &&
        attempt.telepastor_id === contact.current_assignee_id),
  );
}

export function partitionCalledStatusRows(
  rows: CalledStatusRow[],
): CalledPartition {
  const uncalledIds: string[] = [];
  const calledIds: string[] = [];

  for (const row of rows) {
    if (row.isCalled) {
      calledIds.push(row.contactId);
    } else {
      uncalledIds.push(row.contactId);
    }
  }

  return { uncalledIds, calledIds };
}

export function summarizeUndoAssigneePreview(
  planContactIds: string[],
  expectedAssigneeId: string,
  rows: CalledStatusRow[],
): UndoAssigneePreviewCounts {
  const byId = new Map(rows.map((row) => [row.contactId, row]));
  let noAttemptsCount = 0;
  let withAttemptsCount = 0;
  let alreadyMovedCount = 0;

  for (const contactId of planContactIds) {
    const row = byId.get(contactId);

    if (!row || row.currentAssigneeId !== expectedAssigneeId) {
      alreadyMovedCount += 1;
      continue;
    }

    if (row.isCalled) {
      withAttemptsCount += 1;
    } else {
      noAttemptsCount += 1;
    }
  }

  return {
    noAttemptsCount,
    withAttemptsCount,
    alreadyMovedCount,
  };
}

function shouldFallbackFromClassifyRpc(error: {
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
    message.includes("classify_contacts_called_status")
  );
}

async function classifyContactsCalledStatusChunked(
  supabase: SupabaseClient<Database>,
  contactIds: string[],
): Promise<CalledStatusRow[]> {
  const rows: CalledStatusRow[] = [];

  for (const chunk of chunkIds(contactIds, CLASSIFY_TABLE_CHUNK_SIZE)) {
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select(
        "id, latest_response, current_assignment_id, current_assignee_id",
      )
      .in("id", chunk);

    if (contactsError) {
      throw new Error(
        formatSupabaseError(
          contactsError,
          "Failed to load contacts for call-status checks.",
        ),
      );
    }

    const { data: attempts, error: attemptsError } = await supabase
      .from("call_attempts")
      .select("contact_id, assignment_id, telepastor_id")
      .in("contact_id", chunk);

    if (attemptsError) {
      throw new Error(
        formatSupabaseError(
          attemptsError,
          "Failed to load call attempts for call-status checks.",
        ),
      );
    }

    const attemptsByContact = new Map<string, AttemptRow[]>();
    for (const attempt of (attempts ?? []) as AttemptRow[]) {
      const list = attemptsByContact.get(attempt.contact_id) ?? [];
      list.push(attempt);
      attemptsByContact.set(attempt.contact_id, list);
    }

    for (const contact of contacts ?? []) {
      rows.push({
        contactId: contact.id,
        currentAssigneeId: contact.current_assignee_id,
        isCalled: isContactCalledForCurrentWork(
          contact,
          attemptsByContact.get(contact.id) ?? [],
        ),
      });
    }
  }

  return rows;
}

export async function classifyContactsCalledStatus(
  supabase: SupabaseClient<Database>,
  contactIds: string[],
): Promise<CalledStatusRow[]> {
  if (contactIds.length === 0) {
    return [];
  }

  const rows: CalledStatusRow[] = [];

  for (const chunk of chunkIds(contactIds, CLASSIFY_RPC_CHUNK_SIZE)) {
    const { data, error } = await supabase.rpc(
      "classify_contacts_called_status",
      { p_contact_ids: chunk },
    );

    if (error) {
      if (shouldFallbackFromClassifyRpc(error)) {
        return classifyContactsCalledStatusChunked(supabase, contactIds);
      }

      throw new Error(
        formatSupabaseError(
          error,
          "Failed to classify contacts with call attempts.",
        ),
      );
    }

    for (const row of data ?? []) {
      rows.push({
        contactId: row.contact_id,
        currentAssigneeId: row.current_assignee_id,
        isCalled: row.is_called,
      });
    }
  }

  return rows;
}

export async function partitionContactsByCalledStatus(
  supabase: SupabaseClient<Database>,
  contactIds: string[],
): Promise<CalledPartition> {
  const uniqueIds = [...new Set(contactIds)];
  const rows = await classifyContactsCalledStatus(supabase, uniqueIds);
  return partitionCalledStatusRows(rows);
}
