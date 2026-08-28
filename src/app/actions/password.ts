"use server";

import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { formatPasswordUpdateError } from "@/lib/auth/password-errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireAuthSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "@/lib/validations/password";

type ChangePasswordResult =
  | { success: true }
  | { success: false; error: string };

export async function changePasswordAction(
  values: ChangePasswordValues,
): Promise<ChangePasswordResult> {
  const session = await requireAuthSession({ allowPasswordChangePending: true });
  const parsed = changePasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password data.",
    };
  }

  if (!session.telepastor.must_change_password) {
    return {
      success: false,
      error: "You are not required to change your password.",
    };
  }

  const adminClient = createServiceRoleClient();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    session.userId,
    {
      password: parsed.data.newPassword,
    },
  );

  if (updateError) {
    const supabase = await createClient();
    const { error: fallbackError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (fallbackError) {
      return {
        success: false,
        error: formatPasswordUpdateError(
          fallbackError.message ?? updateError.message,
        ),
      };
    }
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("telepastors")
    .update({ must_change_password: false })
    .eq("id", session.telepastor.id);

  if (profileError) {
    return {
      success: false,
      error: profileError.message,
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entityType: "telepastor",
    entityId: session.telepastor.id,
    metadata: {
      forced: session.telepastor.must_change_password,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { success: true };
}
