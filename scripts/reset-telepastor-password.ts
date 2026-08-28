import "dotenv/config";
import { DEFAULT_TELEPASTOR_PASSWORD } from "../src/lib/auth/default-password";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "../src/lib/telepastors/phone";

async function main() {
  const phone = process.argv[2];

  if (!phone) {
    console.error("Usage: npm run reset:telepastor-password -- <phone>");
    process.exit(1);
  }

  const phoneNormalized = getTelepastorPhoneNormalized(phone);
  const supabase = createServiceRoleClient();

  const { data: telepastor, error } = await supabase
    .from("telepastors")
    .select("id, auth_user_id, name")
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (error || !telepastor) {
    throw new Error(error?.message ?? "Telepastor not found for that phone.");
  }

  if (!telepastor.auth_user_id) {
    throw new Error("This telepastor does not have a sign-in account linked.");
  }

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

  console.log(
    `Reset password for ${telepastor.name} (${phone}) to "${DEFAULT_TELEPASTOR_PASSWORD}".`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
