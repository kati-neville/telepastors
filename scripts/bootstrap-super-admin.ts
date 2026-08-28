import "dotenv/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "../src/lib/telepastors/phone";
import type { Database } from "../src/types/database";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME ?? "Super Admin";
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE ?? "0000000000";
  const address = process.env.BOOTSTRAP_ADMIN_ADDRESS ?? "";

  if (!email || !password) {
    console.error(
      "Missing BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD in environment.",
    );
    process.exit(1);
  }

  const supabase: SupabaseClient<Database, "public"> = createServiceRoleClient();
  const phoneNormalized = getTelepastorPhoneNormalized(phone);

  const { data: existingAdmins, error: existingError } = await supabase
    .from("telepastors")
    .select("id")
    .eq("role", "SUPER_ADMIN")
    .limit(1);

  if (existingError) {
    console.error("Failed to check existing admins:", existingError.message);
    process.exit(1);
  }

  if (existingAdmins && existingAdmins.length > 0) {
    console.error("A SUPER_ADMIN already exists. Bootstrap aborted.");
    process.exit(1);
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      phone: phoneNormalized,
      password,
      email_confirm: true,
      phone_confirm: true,
    });

  if (authError || !authData.user) {
    console.error("Failed to create auth user:", authError?.message);
    process.exit(1);
  }

  const { error: profileError } = await supabase.from("telepastors").insert({
    auth_user_id: authData.user.id,
    name,
    phone,
    phone_normalized: phoneNormalized,
    address: address || null,
    role: "SUPER_ADMIN",
    is_active: true,
    must_change_password: false,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    console.error("Failed to create ministry profile:", profileError.message);
    process.exit(1);
  }

  console.log(`SUPER_ADMIN bootstrap complete for ${email}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
