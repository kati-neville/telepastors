import "dotenv/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "../src/lib/telepastors/phone";
import type { Database } from "../src/types/database";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Super Admin";
  // Empty env values override ?? defaults — treat blank as unset.
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE?.trim() || "0200000000";
  const address = process.env.BOOTSTRAP_ADMIN_ADDRESS?.trim() || "";
  const organizationName = (
    process.env.BOOTSTRAP_ADMIN_ORGANIZATION_NAME ??
    process.env.BOOTSTRAP_ORGANIZATION_NAME ??
    ""
  ).trim();

  if (!email || !password) {
    console.error(
      "Missing BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD in environment.",
    );
    process.exit(1);
  }

  if (!organizationName) {
    console.error(
      "Missing BOOTSTRAP_ADMIN_ORGANIZATION_NAME (organization name for this Super Admin workspace).",
    );
    process.exit(1);
  }

  const supabase: SupabaseClient<Database, "public"> = createServiceRoleClient();
  const phoneNormalized = getTelepastorPhoneNormalized(phone);

  const { data: existingOrg, error: existingOrgError } = await supabase
    .from("organizations")
    .select("id, name")
    .ilike("name", organizationName)
    .maybeSingle();

  if (existingOrgError) {
    console.error("Failed to check organizations:", existingOrgError.message);
    process.exit(1);
  }

  let organizationId = existingOrg?.id ?? null;

  if (organizationId) {
    const { data: existingAdmins, error: existingError } = await supabase
      .from("telepastors")
      .select("id")
      .eq("role", "SUPER_ADMIN")
      .eq("organization_id", organizationId)
      .limit(1);

    if (existingError) {
      console.error("Failed to check existing admins:", existingError.message);
      process.exit(1);
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.error(
        `A SUPER_ADMIN already exists for organization "${existingOrg?.name ?? organizationName}". Bootstrap aborted.`,
      );
      process.exit(1);
    }
  } else {
    const { data: createdOrgId, error: createOrgError } = await supabase.rpc(
      "create_organization_with_defaults",
      { p_name: organizationName },
    );

    if (createOrgError || !createdOrgId) {
      // Fallback if RPC is not yet applied: insert org only.
      const { data: insertedOrg, error: insertOrgError } = await supabase
        .from("organizations")
        .insert({ name: organizationName })
        .select("id")
        .single();

      if (insertOrgError || !insertedOrg) {
        console.error(
          "Failed to create organization:",
          createOrgError?.message ?? insertOrgError?.message,
        );
        process.exit(1);
      }

      organizationId = insertedOrg.id;
      await supabase.rpc("seed_organization_whatsapp_templates", {
        p_organization_id: organizationId,
      });
    } else {
      organizationId = createdOrgId;
    }
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
    organization_id: organizationId,
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

  console.log(
    `SUPER_ADMIN bootstrap complete for ${email} in organization "${organizationName}"`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
