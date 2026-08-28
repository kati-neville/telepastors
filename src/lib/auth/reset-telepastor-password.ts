import { DEFAULT_TELEPASTOR_PASSWORD } from "@/lib/auth/default-password";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "@/lib/telepastors/phone";

export type ResetTelepastorPasswordResult = {
  telepastorId: string;
  name: string;
  phone: string;
  temporaryPassword: string;
};

export async function resetTelepastorPassword(
  telepastorId: string,
): Promise<ResetTelepastorPasswordResult> {
  const supabase = createServiceRoleClient();

  const { data: telepastor, error } = await supabase
    .from("telepastors")
    .select("id, auth_user_id, name, phone, phone_normalized")
    .eq("id", telepastorId)
    .maybeSingle();

  if (error || !telepastor) {
    throw new Error(error?.message ?? "Telepastor not found.");
  }

  if (!telepastor.auth_user_id) {
    throw new Error("This member does not have a sign-in account linked.");
  }

  const phoneNormalized =
    telepastor.phone_normalized ?? getTelepastorPhoneNormalized(telepastor.phone);

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    telepastor.auth_user_id,
    {
      password: DEFAULT_TELEPASTOR_PASSWORD,
      phone: phoneNormalized,
      phone_confirm: true,
    },
  );

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: profileError } = await supabase
    .from("telepastors")
    .update({ must_change_password: true })
    .eq("id", telepastor.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    telepastorId: telepastor.id,
    name: telepastor.name,
    phone: telepastor.phone,
    temporaryPassword: DEFAULT_TELEPASTOR_PASSWORD,
  };
}
