import type { SupabaseClient, User } from "@supabase/supabase-js";
import { buildTelepastorAuthEmail } from "@/lib/auth/telepastor-auth-email";
import { findTelepastorByNormalizedPhone } from "@/lib/auth/find-telepastor-by-phone";
import { parseLoginIdentifier } from "@/lib/auth/login-identifier";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SignInResult =
  | { success: true; user: User }
  | { success: false; error: "invalid_credentials" | "profile_missing" | "inactive" };

async function verifyTelepastorProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<"ok" | "profile_missing" | "inactive"> {
  const { data: telepastor, error: profileError } = await supabase
    .from("telepastors")
    .select("id, is_active")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profileError || !telepastor) {
    return "profile_missing";
  }

  if (!telepastor.is_active) {
    return "inactive";
  }

  return "ok";
}

async function signInWithPasswordCredentials(
  supabase: SupabaseClient<Database>,
  credentials: { email: string; password: string } | { phone: string; password: string },
) {
  return supabase.auth.signInWithPassword(credentials);
}

export async function signInWithIdentifier(
  supabase: SupabaseClient<Database>,
  identifier: string,
  password: string,
): Promise<SignInResult> {
  const parsed = parseLoginIdentifier(identifier);

  if (parsed.type === "invalid") {
    return { success: false, error: "invalid_credentials" };
  }

  if (parsed.type === "email") {
    const { data, error } = await signInWithPasswordCredentials(supabase, {
      email: parsed.email,
      password,
    });

    if (error || !data.user) {
      return { success: false, error: "invalid_credentials" };
    }

    const profileStatus = await verifyTelepastorProfile(supabase, data.user.id);

    if (profileStatus !== "ok") {
      await supabase.auth.signOut();
      return { success: false, error: profileStatus };
    }

    return { success: true, user: data.user };
  }

  const phoneAttempt = await signInWithPasswordCredentials(supabase, {
    phone: parsed.phone,
    password,
  });

  if (!phoneAttempt.error && phoneAttempt.data.user) {
    const profileStatus = await verifyTelepastorProfile(
      supabase,
      phoneAttempt.data.user.id,
    );

    if (profileStatus !== "ok") {
      await supabase.auth.signOut();
      return { success: false, error: profileStatus };
    }

    return { success: true, user: phoneAttempt.data.user };
  }

  let adminClient: ReturnType<typeof createServiceRoleClient> | null = null;

  try {
    adminClient = createServiceRoleClient();
  } catch {
    return { success: false, error: "invalid_credentials" };
  }

  const telepastor = await findTelepastorByNormalizedPhone(
    adminClient,
    parsed.phone,
  );

  if (!telepastor?.auth_user_id) {
    return { success: false, error: "invalid_credentials" };
  }

  const { data: authUserData, error: authUserError } =
    await adminClient.auth.admin.getUserById(telepastor.auth_user_id);

  if (authUserError || !authUserData.user) {
    return { success: false, error: "invalid_credentials" };
  }

  const authUser = authUserData.user;
  const authEmail = authUser.email ?? buildTelepastorAuthEmail(telepastor.id);

  const emailAttempt = await signInWithPasswordCredentials(supabase, {
    email: authEmail,
    password,
  });

  if (emailAttempt.error || !emailAttempt.data.user) {
    return { success: false, error: "invalid_credentials" };
  }

  const profileStatus = await verifyTelepastorProfile(
    supabase,
    emailAttempt.data.user.id,
  );

  if (profileStatus !== "ok") {
    await supabase.auth.signOut();
    return { success: false, error: profileStatus };
  }

  if (!authUser.phone) {
    await adminClient.auth.admin.updateUserById(authUser.id, {
      phone: parsed.phone,
      phone_confirm: true,
    });
  }

  return { success: true, user: emailAttempt.data.user };
}
