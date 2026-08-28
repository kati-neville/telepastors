import "dotenv/config";
import { resetTelepastorPassword } from "../src/lib/auth/reset-telepastor-password";
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
    .select("id, name")
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (error || !telepastor) {
    throw new Error(error?.message ?? "Telepastor not found for that phone.");
  }

  const result = await resetTelepastorPassword(telepastor.id);

  console.log(
    `Reset password for ${result.name} (${phone}) to "${result.temporaryPassword}".`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
