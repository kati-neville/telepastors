"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveBroadcastRecipients } from "@/lib/broadcasts/recipients";
import { canSendSmsBroadcasts } from "@/lib/auth/broadcasts";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import { getConfiguredProviderName, getSmsProvider } from "@/lib/sms/get-provider";
import {
  buildMessagePreview,
  estimateSmsUnits,
  personalizeBroadcastMessage,
} from "@/lib/sms/message-utils";
import { SmsProviderNotConfiguredError } from "@/lib/sms/types";
import { getSmsProviderStatusMessage } from "@/lib/sms/unconfigured-provider";
import { buildScopeConfig } from "@/lib/queries/broadcasts";
import { fetchCampaignContactOptions } from "@/lib/broadcasts/recipients";
import { createClient } from "@/lib/supabase/server";
import { broadcastComposerSchema } from "@/lib/validations/broadcasts";
import type { BroadcastPreview } from "@/types/domain";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function requireBroadcastsAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canSendSmsBroadcasts(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}

export async function fetchCampaignContactsAction(
  campaignId: string,
): Promise<
  ActionResult<Array<{ id: string; name: string; phone: string }>>
> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canSendSmsBroadcasts(context)) {
    return { success: false, error: "You are not allowed to send SMS broadcasts." };
  }

  try {
    const contacts = await fetchCampaignContactOptions(campaignId);
    return {
      success: true,
      data: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Failed to load contacts."),
    };
  }
}

export async function previewBroadcastAction(
  values: unknown,
): Promise<ActionResult<BroadcastPreview>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canSendSmsBroadcasts(context)) {
    return { success: false, error: "You are not allowed to send SMS broadcasts." };
  }

  const parsed = broadcastComposerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid broadcast request.",
    };
  }

  const recipients = await resolveBroadcastRecipients(parsed.data);
  if (recipients.length === 0) {
    return {
      success: false,
      error: "No recipients match the selected audience.",
    };
  }

  const sampleRecipient = recipients[0] ?? null;
  const provider = getSmsProvider();

  return {
    success: true,
    data: {
      recipientCount: recipients.length,
      estimatedSmsUnits: estimateSmsUnits(parsed.data.message, recipients.length),
      messagePreview: buildMessagePreview(parsed.data.message, sampleRecipient
        ? {
            name: sampleRecipient.name,
            campaignName: sampleRecipient.campaign_name,
          }
        : undefined),
      sampleRecipientName: sampleRecipient?.name ?? null,
      providerConfigured: provider.isConfigured,
      providerName: getConfiguredProviderName(),
    },
  };
}

export async function confirmBroadcastAction(
  values: unknown,
): Promise<ActionResult<{ broadcastId: string; status: string }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canSendSmsBroadcasts(context)) {
    return { success: false, error: "You are not allowed to send SMS broadcasts." };
  }

  const parsed = broadcastComposerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid broadcast request.",
    };
  }

  const recipients = await resolveBroadcastRecipients(parsed.data);
  if (recipients.length === 0) {
    return {
      success: false,
      error: "No recipients match the selected audience.",
    };
  }

  const provider = getSmsProvider();
  const estimatedSmsUnits = estimateSmsUnits(parsed.data.message, recipients.length);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: broadcast, error: broadcastError } = await supabase
    .from("sms_broadcasts")
    .insert({
      message: parsed.data.message,
      campaign_id: parsed.data.campaignId ?? null,
      recipient_scope: parsed.data.scope,
      scope_config: buildScopeConfig(parsed.data),
      recipient_count: recipients.length,
      estimated_sms_units: estimatedSmsUnits,
      provider: provider.isConfigured ? provider.name : null,
      status: provider.isConfigured ? "SENDING" : "UNAVAILABLE",
      pending_count: recipients.length,
      created_by: session.telepastor.id,
      confirmed_at: now,
      error_message: provider.isConfigured
        ? null
        : getSmsProviderStatusMessage(),
    })
    .select("id, status")
    .single();

  if (broadcastError || !broadcast) {
    return {
      success: false,
      error: toActionErrorMessage(broadcastError, "Failed to create broadcast record."),
    };
  }

  const recipientRows = recipients.map((recipient) => ({
    broadcast_id: broadcast.id,
    contact_id: recipient.id,
    phone_normalized: recipient.phone_normalized,
    contact_name: recipient.name,
    status: provider.isConfigured ? ("PENDING" as const) : ("SKIPPED" as const),
    error_message: provider.isConfigured ? null : getSmsProviderStatusMessage(),
  }));

  const { error: recipientsError } = await supabase
    .from("sms_broadcast_recipients")
    .insert(recipientRows);

  if (recipientsError) {
    await supabase.from("sms_broadcasts").delete().eq("id", broadcast.id);
    return { success: false, error: toActionErrorMessage(recipientsError, "Failed to save recipients.") };
  }

  if (!provider.isConfigured) {
    await supabase
      .from("sms_broadcasts")
      .update({
        failed_count: 0,
        pending_count: 0,
        completed_at: now,
      })
      .eq("id", broadcast.id);

    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${broadcast.id}`);

    await recordAuditEvent({
      actorId: session.telepastor.id,
      action: AUDIT_ACTIONS.SMS_BROADCAST_INITIATED,
      entityType: "sms_broadcast",
      entityId: broadcast.id,
      metadata: {
        status: "UNAVAILABLE",
        recipientCount: recipients.length,
        scope: parsed.data.scope,
        providerConfigured: false,
      },
    });

    return {
      success: true,
      data: {
        broadcastId: broadcast.id,
        status: "UNAVAILABLE",
      },
    };
  }

  try {
    const bulkResult = await provider.sendBulk({
      messages: recipients.map((recipient) => ({
        to: recipient.phone_normalized,
        body: personalizeBroadcastMessage(parsed.data.message, {
          name: recipient.name,
          campaignName: recipient.campaign_name,
        }),
        metadata: { contactId: recipient.id },
      })),
    });

    let deliveredCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    const recipientUpdates = bulkResult.results.map((result, index) => {
      const recipient = recipients[index];
      if (!recipient) return null;

      let recipientStatus: "SENT" | "DELIVERED" | "FAILED" | "PENDING" = "PENDING";
      if (result.success) {
        if (result.status === "delivered") {
          recipientStatus = "DELIVERED";
          deliveredCount += 1;
        } else {
          recipientStatus = "SENT";
          pendingCount += 1;
        }
      } else {
        recipientStatus = "FAILED";
        failedCount += 1;
      }

      return supabase
        .from("sms_broadcast_recipients")
        .update({
          status: recipientStatus,
          provider_message_id: result.messageId ?? null,
          error_message: result.error ?? null,
          sent_at: result.success ? now : null,
          delivered_at: result.status === "delivered" ? now : null,
        })
        .eq("broadcast_id", broadcast.id)
        .eq("contact_id", recipient.id);
    });

    await Promise.all(recipientUpdates.filter(Boolean));

    const finalStatus =
      failedCount === recipients.length ? "FAILED" : "COMPLETED";

    await supabase
      .from("sms_broadcasts")
      .update({
        status: finalStatus,
        delivered_count: deliveredCount,
        failed_count: failedCount,
        pending_count: pendingCount,
        sent_at: now,
        completed_at: now,
      })
      .eq("id", broadcast.id);

    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${broadcast.id}`);

    await recordAuditEvent({
      actorId: session.telepastor.id,
      action: AUDIT_ACTIONS.SMS_BROADCAST_INITIATED,
      entityType: "sms_broadcast",
      entityId: broadcast.id,
      metadata: {
        status: finalStatus,
        recipientCount: recipients.length,
        scope: parsed.data.scope,
        provider: provider.name,
        deliveredCount,
        failedCount,
        pendingCount,
      },
    });

    return {
      success: true,
      data: {
        broadcastId: broadcast.id,
        status: finalStatus,
      },
    };
  } catch (error) {
    const message =
      error instanceof SmsProviderNotConfiguredError
        ? getSmsProviderStatusMessage()
        : error instanceof Error
          ? error.message
          : "SMS send failed.";

    await supabase
      .from("sms_broadcasts")
      .update({
        status: "FAILED",
        failed_count: recipients.length,
        pending_count: 0,
        error_message: message,
        completed_at: now,
      })
      .eq("id", broadcast.id);

    await supabase
      .from("sms_broadcast_recipients")
      .update({
        status: "FAILED",
        error_message: message,
      })
      .eq("broadcast_id", broadcast.id);

    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${broadcast.id}`);

    return {
      success: false,
      error: toActionErrorMessage(error, "SMS send failed."),
    };
  }
}
