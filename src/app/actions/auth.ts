"use server";

import { redirect } from "next/navigation";
import { signInWithIdentifier } from "@/lib/auth/sign-in-with-identifier";
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
  const result = await signInWithIdentifier(
    supabase,
    parsed.data.identifier,
    parsed.data.password,
  );

  if (!result.success) {
    return { success: false, error: result.error };
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
