"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  resolveHierarchyFields,
  validateHierarchy,
} from "@/lib/auth/hierarchy";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import {
  canChangeRole,
  canCreateTelepastor,
  canEditTelepastorProfile,
  canManageTelepastor,
  canToggleTelepastorActive,
  canViewUser,
} from "@/lib/auth/permissions";
import { getDefaultTelepastorPassword } from "@/lib/auth/default-password";
import {
  deleteAuthUser,
  provisionTelepastorAuthUser,
} from "@/lib/auth/provision-auth-user";
import { requireAuthSession } from "@/lib/auth/session";
import { getTelepastorPhoneNormalized } from "@/lib/telepastors/phone";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import { fetchTelepastorById } from "@/lib/queries/telepastors";
import { createClient } from "@/lib/supabase/server";
import {
  createTelepastorSchema,
  PROFILE_PHOTO_ACCEPT,
  PROFILE_PHOTO_MAX_BYTES,
  toggleActiveSchema,
  updateTelepastorProfileSchema,
  updateTelepastorRoleSchema,
} from "@/lib/validations/telepastors";

type ActionResult =
  | {
      success: true;
      id?: string;
      temporaryPassword?: string;
      phone?: string;
      name?: string;
    }
  | { success: false; error: string };

function revalidateTelepastorPaths(id?: string) {
  revalidatePath("/profile");
  revalidatePath("/telepastors");
  if (id) {
    revalidatePath(`/telepastors/${id}`);
    revalidatePath(`/telepastors/${id}/edit`);
  }
}

export async function createTelepastorAction(
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canCreateTelepastor(context)) {
    return { success: false, error: "You are not allowed to create Telepastors." };
  }

  const parsed = createTelepastorSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
    };
  }

  const hierarchyError = validateHierarchy({
    role: parsed.data.role,
    leader_id: parsed.data.leader_id ?? null,
    governor_id: parsed.data.governor_id ?? null,
  });

  if (hierarchyError) {
    return { success: false, error: hierarchyError };
  }

  const hierarchy = resolveHierarchyFields({
    role: parsed.data.role,
    leader_id: parsed.data.leader_id,
    governor_id: parsed.data.governor_id,
  });

  const supabase = await createClient();
  let phoneNormalized: string;

  try {
    phoneNormalized = getTelepastorPhoneNormalized(parsed.data.phone);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Enter a valid phone number.",
    };
  }

  const { data, error } = await supabase
    .from("telepastors")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      phone_normalized: phoneNormalized,
      address: parsed.data.address,
      role: parsed.data.role,
      leader_id: hierarchy.leader_id,
      governor_id: hierarchy.governor_id,
      is_active: true,
      must_change_password: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to create Telepastor."),
    };
  }

  const temporaryPassword = getDefaultTelepastorPassword();

  try {
    const { authUserId } = await provisionTelepastorAuthUser({
      telepastorId: data.id,
      phoneNormalized,
      password: temporaryPassword,
    });

    const { error: linkError } = await supabase
      .from("telepastors")
      .update({
        auth_user_id: authUserId,
      })
      .eq("id", data.id);

    if (linkError) {
      await deleteAuthUser(authUserId);
      await supabase.from("telepastors").delete().eq("id", data.id);
      return {
        success: false,
        error: toActionErrorMessage(
          linkError,
          "Unable to link the new sign-in account.",
        ),
      };
    }
  } catch (provisionError) {
    await supabase.from("telepastors").delete().eq("id", data.id);
    return {
      success: false,
      error:
        provisionError instanceof Error
          ? provisionError.message
          : "Unable to create the sign-in account.",
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.TELEPASTOR_CREATED,
    entityType: "telepastor",
    entityId: data.id,
    metadata: {
      name: parsed.data.name,
      role: parsed.data.role,
      accountProvisioned: true,
    },
  });

  revalidateTelepastorPaths(data.id);

  return {
    success: true,
    id: data.id,
    temporaryPassword,
    phone: parsed.data.phone,
    name: parsed.data.name,
  };
}

export async function updateTelepastorProfileAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const existing = await fetchTelepastorById(id);

  if (!existing) {
    return { success: false, error: "Telepastor not found." };
  }

  if (!canEditTelepastorProfile(context, existing)) {
    return { success: false, error: "You are not allowed to edit this profile." };
  }

  const parsed = updateTelepastorProfileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
    };
  }

  const supabase = await createClient();
  let phoneNormalized: string;

  try {
    phoneNormalized = getTelepastorPhoneNormalized(parsed.data.phone);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Enter a valid phone number.",
    };
  }

  const { error } = await supabase
    .from("telepastors")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      phone_normalized: phoneNormalized,
      address: parsed.data.address || null,
      date_of_birth: parsed.data.date_of_birth || null,
      occupation: parsed.data.occupation || null,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to update profile."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.TELEPASTOR_PROFILE_UPDATED,
    entityType: "telepastor",
    entityId: id,
    metadata: { name: parsed.data.name },
  });

  revalidateTelepastorPaths(id);
  return { success: true, id };
}

export async function updateTelepastorRoleAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const existing = await fetchTelepastorById(id);

  if (!existing) {
    return { success: false, error: "Telepastor not found." };
  }

  if (!canChangeRole(context)) {
    return {
      success: false,
      error: "Only Super Admins can change ministry roles.",
    };
  }

  if (existing.role === "SUPER_ADMIN") {
    return {
      success: false,
      error: "Super Admin roles cannot be changed from the directory.",
    };
  }

  const parsed = updateTelepastorRoleSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid role change request.",
    };
  }

  const hierarchyError = validateHierarchy({
    role: parsed.data.role,
    leader_id: parsed.data.leader_id ?? null,
    governor_id: parsed.data.governor_id ?? null,
  });

  if (hierarchyError) {
    return { success: false, error: hierarchyError };
  }

  const hierarchy = resolveHierarchyFields({
    role: parsed.data.role,
    leader_id: parsed.data.leader_id,
    governor_id: parsed.data.governor_id,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("telepastors")
    .update({
      role: parsed.data.role,
      leader_id: hierarchy.leader_id,
      governor_id: hierarchy.governor_id,
    })
    .eq("id", id);

  if (error) {
    return { success: false, error: toActionErrorMessage(error, "Unable to change role.") };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.TELEPASTOR_ROLE_CHANGED,
    entityType: "telepastor",
    entityId: id,
    metadata: {
      previousRole: existing.role,
      newRole: parsed.data.role,
      name: existing.name,
    },
  });

  revalidateTelepastorPaths(id);
  return { success: true, id };
}

export async function toggleTelepastorActiveAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const existing = await fetchTelepastorById(id);

  if (!existing) {
    return { success: false, error: "Telepastor not found." };
  }

  if (!canToggleTelepastorActive(context, existing)) {
    return {
      success: false,
      error: "You are not allowed to change this member's status.",
    };
  }

  if (existing.role === "SUPER_ADMIN") {
    return {
      success: false,
      error: "Super Admin accounts cannot be deactivated from the directory.",
    };
  }

  const parsed = toggleActiveSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Confirmation is required.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("telepastors")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to change member status."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: parsed.data.is_active
      ? AUDIT_ACTIONS.TELEPASTOR_ACTIVATED
      : AUDIT_ACTIONS.TELEPASTOR_DEACTIVATED,
    entityType: "telepastor",
    entityId: id,
    metadata: { name: existing.name },
  });

  revalidateTelepastorPaths(id);
  return { success: true, id };
}

export async function uploadProfilePhotoAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  const telepastorId = formData.get("telepastorId");
  const file = formData.get("file");

  if (typeof telepastorId !== "string" || !(file instanceof File)) {
    return { success: false, error: "Invalid upload request." };
  }

  const existing = await fetchTelepastorById(telepastorId);
  if (!existing) {
    return { success: false, error: "Telepastor not found." };
  }

  if (!canEditTelepastorProfile(context, existing)) {
    return { success: false, error: "You are not allowed to update this photo." };
  }

  if (!PROFILE_PHOTO_ACCEPT.split(",").includes(file.type)) {
    return {
      success: false,
      error: "Photo must be a JPEG, PNG, or WebP image.",
    };
  }

  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return { success: false, error: "Photo must be 2MB or smaller." };
  }

  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${telepastorId}/avatar.${extension}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("profile-pictures")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return {
      success: false,
      error: toActionErrorMessage(uploadError, "Unable to upload photo."),
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-pictures").getPublicUrl(path);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("telepastors")
    .update({ profile_picture_url: cacheBustedUrl })
    .eq("id", telepastorId);

  if (updateError) {
    return {
      success: false,
      error: toActionErrorMessage(updateError, "Unable to save photo."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.TELEPASTOR_PHOTO_UPDATED,
    entityType: "telepastor",
    entityId: telepastorId,
  });

  revalidateTelepastorPaths(telepastorId);
  return { success: true, id: telepastorId };
}

export async function requireProfileAccess() {
  const session = await requireAuthSession();
  const telepastor = await fetchTelepastorById(session.telepastor.id);

  if (!telepastor) {
    redirect("/login?error=profile_missing");
  }

  return { session, telepastor };
}

export async function requireTelepastorAccess(id: string) {
  const session = await requireAuthSession();
  const telepastor = await fetchTelepastorById(id);

  if (
    !telepastor ||
    !canViewUser(
      { telepastor: session.telepastor },
      telepastor,
      telepastor.leader,
    )
  ) {
    redirect("/telepastors");
  }

  return { session, telepastor };
}

export async function requireTelepastorEditAccess(id: string) {
  const { session, telepastor } = await requireTelepastorAccess(id);

  if (!canEditTelepastorProfile({ telepastor: session.telepastor }, telepastor)) {
    redirect(`/telepastors/${id}`);
  }

  return { session, telepastor };
}

export async function requireTelepastorManageAccess(id: string) {
  const { session, telepastor } = await requireTelepastorAccess(id);

  if (!canManageTelepastor({ telepastor: session.telepastor }, telepastor)) {
    redirect(`/telepastors/${id}`);
  }

  return { session, telepastor };
}
