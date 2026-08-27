"use server";

import { redirect } from "next/navigation";
import { clearAuthSession } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";

type AuthActionResult =
  | { success: true }
  | { success: false; error: string };

export async function loginAction(
  values: LoginFormValues,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: "invalid_credentials" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { success: false, error: "invalid_credentials" };
  }

  const { data: telepastor, error: profileError } = await supabase
    .from("telepastors")
    .select("id, is_active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (profileError || !telepastor) {
    await supabase.auth.signOut();
    return { success: false, error: "profile_missing" };
  }

  if (!telepastor.is_active) {
    await supabase.auth.signOut();
    return { success: false, error: "inactive" };
  }

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  const result = await clearAuthSession(supabase);

  if (!result.success) {
    throw new Error(result.error);
  }

  redirect("/login");
}
