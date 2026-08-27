import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, Telepastor } from "@/types/domain";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentTelepastor(): Promise<Telepastor | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("telepastors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function requireAuthSession(): Promise<AuthSession> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    redirect("/login");
  }

  const { data: telepastor, error: profileError } = await supabase
    .from("telepastors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !telepastor) {
    redirect("/login?error=profile_missing");
  }

  if (!telepastor.is_active) {
    redirect("/login?error=inactive");
  }

  return {
    userId: user.id,
    email: user.email,
    telepastor,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
