"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageWhatsAppTemplates,
  canViewWhatsAppTemplates,
} from "@/lib/auth/broadcasts";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import { createClient } from "@/lib/supabase/server";
import { whatsAppTemplateSchema } from "@/lib/validations/broadcasts";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function requireWhatsAppTemplatesAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canManageWhatsAppTemplates(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}

export async function saveWhatsAppTemplateAction(
  values: unknown,
  templateId?: string,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canManageWhatsAppTemplates(context)) {
    return {
      success: false,
      error: "You are not allowed to manage WhatsApp templates.",
    };
  }

  const parsed = whatsAppTemplateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid template data.",
    };
  }

  const supabase = await createClient();
  let savedTemplateId = templateId;

  if (parsed.data.isDefault) {
    await supabase
      .from("whatsapp_message_templates")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  if (templateId) {
    const { error } = await supabase
      .from("whatsapp_message_templates")
      .update({
        name: parsed.data.name,
        slug: parsed.data.slug,
        body: parsed.data.body,
        is_default: parsed.data.isDefault ?? false,
        is_active: parsed.data.isActive ?? true,
      })
      .eq("id", templateId);

    if (error) {
      return {
        success: false,
        error: toActionErrorMessage(error, "Unable to save template."),
      };
    }
  } else {
    const { data, error } = await supabase.from("whatsapp_message_templates").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      body: parsed.data.body,
      is_default: parsed.data.isDefault ?? false,
      is_active: parsed.data.isActive ?? true,
      created_by: session.telepastor.id,
    }).select("id").single();

    if (error) {
      return {
        success: false,
        error: toActionErrorMessage(error, "Unable to create template."),
      };
    }

    savedTemplateId = data?.id;
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: parsed.data.isDefault
      ? AUDIT_ACTIONS.WHATSAPP_TEMPLATE_DEFAULT_CHANGED
      : AUDIT_ACTIONS.WHATSAPP_TEMPLATE_SAVED,
    entityType: "whatsapp_message_template",
    entityId: savedTemplateId ?? null,
    metadata: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      isDefault: parsed.data.isDefault ?? false,
    },
  });

  revalidatePath("/broadcasts/templates");
  revalidatePath("/my-calls/queue");
  return { success: true };
}

export async function setDefaultWhatsAppTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canManageWhatsAppTemplates(context)) {
    return { success: false, error: "You are not allowed to manage templates." };
  }

  const supabase = await createClient();

  await supabase
    .from("whatsapp_message_templates")
    .update({ is_default: false })
    .eq("is_default", true);

  const { error } = await supabase
    .from("whatsapp_message_templates")
    .update({ is_default: true, is_active: true })
    .eq("id", templateId);

  if (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to set default template."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.WHATSAPP_TEMPLATE_DEFAULT_CHANGED,
    entityType: "whatsapp_message_template",
    entityId: templateId,
  });

  revalidatePath("/broadcasts/templates");
  revalidatePath("/my-calls/queue");
  return { success: true };
}

export async function requireWhatsAppTemplateViewAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canViewWhatsAppTemplates(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}
