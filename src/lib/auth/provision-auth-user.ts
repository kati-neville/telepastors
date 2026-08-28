import { buildTelepastorAuthEmail } from "@/lib/auth/telepastor-auth-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type ProvisionTelepastorAuthUserInput = {
  telepastorId: string;
  phoneNormalized: string;
  password: string;
};

type ProvisionTelepastorAuthUserResult = {
  authUserId: string;
  authEmail: string;
};

export async function provisionTelepastorAuthUser(
  input: ProvisionTelepastorAuthUserInput,
): Promise<ProvisionTelepastorAuthUserResult> {
  const adminClient = createServiceRoleClient();
  const authEmail = buildTelepastorAuthEmail(input.telepastorId);

  const { data, error } = await adminClient.auth.admin.createUser({
    email: authEmail,
    phone: input.phoneNormalized,
    password: input.password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      telepastor_id: input.telepastorId,
      must_change_password: true,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Unable to create sign-in account.");
  }

  return {
    authUserId: data.user.id,
    authEmail,
  };
}

export async function deleteAuthUser(authUserId: string): Promise<void> {
  const adminClient = createServiceRoleClient();
  const { error } = await adminClient.auth.admin.deleteUser(authUserId);

  if (error) {
    throw new Error(error.message);
  }
}
