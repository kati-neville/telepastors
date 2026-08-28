import "dotenv/config";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "../src/lib/telepastors/phone";

async function main() {
  const supabase = createServiceRoleClient();

  const { data: telepastors, error } = await supabase
    .from("telepastors")
    .select("id, auth_user_id, phone")
    .not("auth_user_id", "is", null);

  if (error) {
    throw new Error(`Failed to load telepastors: ${error.message}`);
  }

  let updatedProfiles = 0;
  let updatedAuthUsers = 0;

  for (const telepastor of telepastors ?? []) {
    if (!telepastor.auth_user_id) {
      continue;
    }

    const phoneNormalized = getTelepastorPhoneNormalized(telepastor.phone);

    const { error: profileError } = await supabase
      .from("telepastors")
      .update({ phone_normalized: phoneNormalized })
      .eq("id", telepastor.id);

    if (profileError) {
      throw new Error(
        `Failed to update telepastor ${telepastor.id}: ${profileError.message}`,
      );
    }

    updatedProfiles += 1;

    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.getUserById(telepastor.auth_user_id);

    if (authUserError || !authUserData.user) {
      throw new Error(
        `Failed to load auth user ${telepastor.auth_user_id}: ${authUserError?.message ?? "Unknown error"}`,
      );
    }

    if (!authUserData.user.phone) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        telepastor.auth_user_id,
        {
          phone: phoneNormalized,
          phone_confirm: true,
        },
      );

      if (authUpdateError) {
        throw new Error(
          `Failed to update auth user ${telepastor.auth_user_id}: ${authUpdateError.message}`,
        );
      }

      updatedAuthUsers += 1;
    }
  }

  console.log(
    `Synced ${updatedProfiles} telepastor profile(s) and ${updatedAuthUsers} auth user phone(s).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
