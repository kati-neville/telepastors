import { redirect } from "next/navigation";
import { isSyntheticTelepastorAuthEmail } from "@/lib/auth/telepastor-auth-email";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession, Telepastor } from "@/types/domain";

type RequireAuthSessionOptions = {
  allowPasswordChangePending?: boolean;
};

function buildLoginIdentifier(
  email: string | null,
  phone: string | null,
  telepastorPhone: string,
): string {
  if (phone) {
    return phone;
  }

  if (email && !isSyntheticTelepastorAuthEmail(email)) {
    return email;
  }

  return telepastorPhone;
}

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

export async function requireAuthSession(
  options: RequireAuthSessionOptions = {},
): Promise<AuthSession> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || (!user.email && !user.phone)) {
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

  if (
    telepastor.must_change_password &&
    !options.allowPasswordChangePending
  ) {
    redirect("/change-password");
  }

  const email = user.email ?? null;
  const phone = user.phone ?? null;

  return {
    userId: user.id,
    email,
    phone,
    loginIdentifier: buildLoginIdentifier(email, phone, telepastor.phone),
    telepastor,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
