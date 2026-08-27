"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAssignContact,
  canAssignContactToAssignee,
  canDistributeContacts,
} from "@/lib/auth/assignments";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import {
  fetchAssigneeById,
  fetchContactsByIds,
} from "@/lib/queries/assignments";
import { fetchCampaignById } from "@/lib/queries/campaigns";
import { createClient } from "@/lib/supabase/server";
import { assignContactsSchema } from "@/lib/validations/assignments";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateAssignmentPaths(campaignId: string) {
  revalidatePath("/assignments");
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/distribute`);
}

export async function assignContactsAction(
  values: unknown,
): Promise<ActionResult<{ assignedCount: number }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = assignContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment request.",
    };
  }

  const { campaignId, contactIds, assigneeId, notes } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const assignee = await fetchAssigneeById(assigneeId);
  if (!assignee || !assignee.is_active) {
    return { success: false, error: "Assignee not found or inactive." };
  }

  if (!canAssignContactToAssignee(context, assignee)) {
    return {
      success: false,
      error: "You cannot assign contacts to this ministry member.",
    };
  }

  const contacts = await fetchContactsByIds(contactIds);

  if (contacts.length !== contactIds.length) {
    return { success: false, error: "One or more contacts were not found." };
  }

  const invalidContacts = contacts.filter(
    (contact) =>
      contact.campaign_id !== campaignId ||
      !canAssignContact(context, contact),
  );

  if (invalidContacts.length > 0) {
    return {
      success: false,
      error: "You cannot assign one or more of the selected contacts.",
    };
  }

  const supabase = await createClient();
  let assignedCount = 0;
  let reassignedCount = 0;

  for (const contact of contacts) {
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
        assignee_id: assigneeId,
        assigned_by: session.telepastor.id,
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
        current_assignee_id: assigneeId,
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

    assignedCount += 1;
    if (isReassignment) {
      reassignedCount += 1;
    }
  }

  revalidateAssignmentPaths(campaignId);

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action:
      reassignedCount > 0
        ? AUDIT_ACTIONS.CONTACTS_REASSIGNED
        : AUDIT_ACTIONS.CONTACTS_ASSIGNED,
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      assigneeId,
      assigneeName: assignee.name,
      assignedCount,
      reassignedCount,
      contactIds,
    },
  });

  return {
    success: true,
    data: { assignedCount },
  };
}

export async function requireCampaignDistributionAccess(campaignId: string) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    redirect("/dashboard");
  }

  const campaign = await fetchCampaignById(campaignId);

  if (!campaign) {
    redirect(context.telepastor.role === "LEADER" ? "/assignments" : "/campaigns");
  }

  if (context.telepastor.role === "LEADER") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("current_assignee_id", session.telepastor.id);

    if (!count) {
      redirect("/assignments");
    }
  } else if (
    context.telepastor.role === "GOVERNOR" ||
    context.telepastor.role === "SUPER_ADMIN"
  ) {
    if (!canDistributeContacts(context)) {
      redirect("/campaigns");
    }
  }

  return { session, campaign, context };
}

export async function requireAssignmentsAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}
