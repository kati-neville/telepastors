import type { SupabaseClient } from "@supabase/supabase-js";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import type { Database } from "@/types/database";

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

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, campaign_id, current_assignee_id, held_for_own_calls")
    .in("id", contactIds);

  if (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Failed to load retained contacts."),
    };
  }

  if ((contacts ?? []).length !== contactIds.length) {
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
    .in("id", contactIds)
    .eq("current_assignee_id", actorId);

  if (updateError) {
    return {
      success: false,
      error: toActionErrorMessage(
        updateError,
        "Failed to mark contacts for your own calls.",
      ),
    };
  }

  return { success: true };
}
