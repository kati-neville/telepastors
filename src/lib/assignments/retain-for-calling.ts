import type { SupabaseClient } from "@supabase/supabase-js";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import { formatSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database";

const RETAIN_RPC_CHUNK_SIZE = 200;
const RETAIN_TABLE_CHUNK_SIZE = 20;

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function shouldFallbackFromRetainRpc(error: {
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
    message.includes("mark_contacts_held_for_own_calls")
  );
}

async function markContactsHeldForOwnCallsChunked(
  supabase: SupabaseClient<Database>,
  params: {
    contactIds: string[];
    actorId: string;
    campaignId: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const { contactIds, actorId, campaignId } = params;

  for (const chunk of chunkIds(contactIds, RETAIN_TABLE_CHUNK_SIZE)) {
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, campaign_id, current_assignee_id")
      .in("id", chunk);

    if (error) {
      return {
        success: false,
        error: formatSupabaseError(error, "Failed to load retained contacts."),
      };
    }

    if ((contacts ?? []).length !== chunk.length) {
      return {
        success: false,
        error: "One or more retained contacts were not found.",
      };
    }

    for (const contact of contacts ?? []) {
      if (contact.campaign_id !== campaignId) {
        return {
          success: false,
          error: "One or more retained contacts are not in this campaign.",
        };
      }

      if (contact.current_assignee_id !== actorId) {
        return {
          success: false,
          error: "You can only retain contacts currently assigned to you.",
        };
      }
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ held_for_own_calls: true })
      .in("id", chunk)
      .eq("current_assignee_id", actorId);

    if (updateError) {
      return {
        success: false,
        error: formatSupabaseError(
          updateError,
          "Failed to mark contacts for your own calls.",
        ),
      };
    }
  }

  return { success: true };
}

export async function markContactsHeldForOwnCalls(
  supabase: SupabaseClient<Database>,
  params: {
    contactIds: string[];
    actorId: string;
    campaignId: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const { contactIds, actorId, campaignId } = params;

  if (contactIds.length === 0) {
    return { success: true };
  }

  for (const chunk of chunkIds(contactIds, RETAIN_RPC_CHUNK_SIZE)) {
    const { error } = await supabase.rpc("mark_contacts_held_for_own_calls", {
      p_campaign_id: campaignId,
      p_actor_id: actorId,
      p_contact_ids: chunk,
    });

    if (!error) {
      continue;
    }

    if (shouldFallbackFromRetainRpc(error)) {
      return markContactsHeldForOwnCallsChunked(supabase, params);
    }

    return {
      success: false,
      error: toActionErrorMessage(
        formatSupabaseError(error, "Failed to mark contacts for your own calls."),
        "Failed to mark contacts for your own calls.",
      ),
    };
  }

  return { success: true };
}
