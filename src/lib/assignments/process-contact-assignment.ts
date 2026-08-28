import type { SupabaseClient } from "@supabase/supabase-js";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import type { Database } from "@/types/database";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type AssigneeRow = {
  id: string;
  name: string;
  role: Database["public"]["Enums"]["ministry_role"];
};

export async function assignContactToAssignee(
  supabase: SupabaseClient<Database>,
  params: {
    contact: ContactRow;
    assignee: AssigneeRow;
    campaignId: string;
    assignedBy: string;
    notes?: string | null;
  },
): Promise<
  | { success: true; isReassignment: boolean }
  | { success: false; error: string }
> {
  const { contact, assignee, campaignId, assignedBy, notes } = params;
  const isReassignment = Boolean(contact.current_assignment_id);

  if (isReassignment && contact.current_assignment_id) {
    const { data: endedRows, error: endError } = await supabase
      .from("contact_assignments")
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq("id", contact.current_assignment_id)
      .is("ended_at", null)
      .select("id");

    if (endError) {
      return {
        success: false,
        error: toActionErrorMessage(
          endError,
          "Failed to end the previous assignment.",
        ),
      };
    }

    if (!endedRows?.length) {
      return {
        success: false,
        error:
          "Failed to end the previous assignment. You may not have permission to reassign this contact.",
      };
    }
  }

  const { data: newAssignment, error: insertError } = await supabase
    .from("contact_assignments")
    .insert({
      contact_id: contact.id,
      campaign_id: campaignId,
      assignee_id: assignee.id,
      assigned_by: assignedBy,
      assignee_role: assignee.role,
      status: "ASSIGNED",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertError || !newAssignment) {
    return {
      success: false,
      error: toActionErrorMessage(insertError, "Failed to create assignment."),
    };
  }

  if (isReassignment && contact.current_assignment_id) {
    await supabase
      .from("contact_assignments")
      .update({ superseded_by: newAssignment.id })
      .eq("id", contact.current_assignment_id);
  }

  const { error: updateContactError } = await supabase
    .from("contacts")
    .update({
      assignment_status: "ASSIGNED",
      current_assignee_id: assignee.id,
      current_assignment_id: newAssignment.id,
      latest_response: null,
    })
    .eq("id", contact.id);

  if (updateContactError) {
    return {
      success: false,
      error: toActionErrorMessage(updateContactError, "Failed to update contact."),
    };
  }

  return { success: true, isReassignment };
}
