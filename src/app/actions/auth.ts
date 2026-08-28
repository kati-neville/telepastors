"use server";

import { redirect } from "next/navigation";
import { signInWithIdentifier } from "@/lib/auth/sign-in-with-identifier";
import { clearAuthSession } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";

type AuthActionResult =
  | { success: true; mustChangePassword: boolean }
  | { success: false; error: string };

export async function loginAction(
  values: LoginFormValues,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: "invalid_credentials" };
  }

  const supabase = await createClient();
  const result = await signInWithIdentifier(
    supabase,
    parsed.data.identifier,
    parsed.data.password,
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const { data: telepastor, error: profileError } = await supabase
    .from("telepastors")
    .select("must_change_password")
    .eq("auth_user_id", result.user.id)
    .maybeSingle();

  if (profileError || !telepastor) {
    await supabase.auth.signOut();
    return { success: false, error: "profile_missing" };
  }

  return {
    success: true,
    mustChangePassword: telepastor.must_change_password,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  const result = await clearAuthSession(supabase);

  if (!result.success) {
    throw new Error(result.error);
  }

  redirect("/login");
}
