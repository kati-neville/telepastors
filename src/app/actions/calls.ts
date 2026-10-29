"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessCallQueue,
  canRecordCallAttempt,
} from "@/lib/auth/calls";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import {
  fetchNextQueueContacts,
  fetchOwnAssignedContactRow,
} from "@/lib/queries/calls";
import { createClient } from "@/lib/supabase/server";
import {
  fetchNextQueueContactsSchema,
  recordCallAttemptSchema,
} from "@/lib/validations/calls";
import type { CallQueueContact } from "@/types/domain";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateCallListPaths() {
  revalidatePath("/my-calls");
  revalidatePath("/my-calls/list");
}

export async function recordCallAttemptAction(
  values: unknown,
): Promise<ActionResult<{ attemptId: string }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canAccessCallQueue(context)) {
    return {
      success: false,
      error: "You are not allowed to record call responses.",
    };
  }

  const parsed = recordCallAttemptSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid call response.",
    };
  }

  const { contactId, response, notes } = parsed.data;

  const contact = await fetchOwnAssignedContactRow(context, contactId);
  if (!contact) {
    return {
      success: false,
      error: "Contact not found or not assigned to you.",
    };
  }

  if (!canRecordCallAttempt(context, contact)) {
    return {
      success: false,
      error: "You cannot record a response for this contact.",
    };
  }

  const supabase = await createClient();

  const { data: attempt, error: insertError } = await supabase
    .from("call_attempts")
    .insert({
      organization_id: contact.organization_id ?? session.telepastor.organization_id,
      contact_id: contact.id,
      campaign_id: contact.campaign_id,
      telepastor_id: session.telepastor.id,
      assignment_id: contact.current_assignment_id,
      response,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !attempt) {
    return {
      success: false,
      error: toActionErrorMessage(insertError, "Failed to save call response."),
    };
  }

  const nextAssignmentStatus =
    contact.assignment_status === "ASSIGNED" ? "IN_PROGRESS" : contact.assignment_status;

  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      latest_response: response,
      latest_notes: notes?.trim() || null,
      latest_response_at: new Date().toISOString(),
      latest_recorded_by: session.telepastor.id,
      assignment_status: nextAssignmentStatus,
    })
    .eq("id", contact.id)
    .eq("current_assignee_id", session.telepastor.id);

  if (updateError) {
    return {
      success: false,
      error: toActionErrorMessage(updateError, "Failed to update contact response."),
    };
  }

  after(async () => {
    await recordAuditEvent({
      actorId: session.telepastor.id,
      action: AUDIT_ACTIONS.CALL_RESPONSE_RECORDED,
      entityType: "contact",
      entityId: contact.id,
      metadata: {
        response,
        campaignId: contact.campaign_id,
        contactName: contact.name,
      },
    });
    revalidateCallListPaths();
  });

  return {
    success: true,
    data: {
      attemptId: attempt.id,
    },
  };
}

export async function fetchNextQueueContactsAction(
  values: unknown,
): Promise<ActionResult<{ contacts: CallQueueContact[] }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canAccessCallQueue(context)) {
    return {
      success: false,
      error: "You are not allowed to load the call queue.",
    };
  }

  const parsed = fetchNextQueueContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid queue request.",
    };
  }

  const contacts = await fetchNextQueueContacts(context, {
    campaignId: parsed.data.campaignId,
    skipContactIds: parsed.data.skipContactIds,
    limit: parsed.data.limit ?? 2,
  });

  return {
    success: true,
    data: { contacts },
  };
}

export async function requireCallQueueAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canAccessCallQueue(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}

export async function requireMyCallsAccess() {
  return requireCallQueueAccess();
}
