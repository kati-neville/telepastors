import "dotenv/config";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import {
  assertDevOrForced,
  clearContactsAssignmentPointers,
  deleteAllRows,
  listAllAuthUsers,
  parseFlag,
} from "./lib/db-script-utils";

async function clearOperationalData(
  fullReset: boolean,
  keepSuperAdmin: boolean,
) {
  const supabase = createServiceRoleClient();

  console.log("Clearing operational data...");
  await deleteAllRows(supabase, "sms_broadcast_recipients");
  await deleteAllRows(supabase, "sms_broadcasts");
  await deleteAllRows(supabase, "call_attempts");
  await clearContactsAssignmentPointers(supabase);
  await deleteAllRows(supabase, "contact_assignments");
  await deleteAllRows(supabase, "contacts");
  await deleteAllRows(supabase, "contact_imports");
  await deleteAllRows(supabase, "campaigns");
  await deleteAllRows(supabase, "audit_logs");
  await deleteAllRows(supabase, "whatsapp_message_templates");

  const { data: superAdmins, error: superAdminError } = await supabase
    .from("telepastors")
    .select("id, auth_user_id")
    .eq("role", "SUPER_ADMIN");

  if (superAdminError) {
    throw new Error(`Failed to load super admins: ${superAdminError.message}`);
  }

  const preservedSuperAdminIds = new Set<string>();
  const preservedAuthUserIds = new Set<string>();

  if (keepSuperAdmin && !fullReset) {
    for (const admin of superAdmins ?? []) {
      preservedSuperAdminIds.add(admin.id);

      if (admin.auth_user_id) {
        preservedAuthUserIds.add(admin.auth_user_id);
      }
    }
  }

  const { data: telepastors, error: telepastorError } = await supabase
    .from("telepastors")
    .select("id, auth_user_id");

  if (telepastorError) {
    throw new Error(`Failed to load telepastors: ${telepastorError.message}`);
  }

  const telepastorIdsToDelete =
    fullReset || !keepSuperAdmin
      ? (telepastors ?? []).map((row) => row.id)
      : (telepastors ?? [])
          .filter((row) => !preservedSuperAdminIds.has(row.id))
          .map((row) => row.id);

  if (telepastorIdsToDelete.length > 0) {
    const { error: deleteTelepastorsError } = await supabase
      .from("telepastors")
      .delete()
      .in("id", telepastorIdsToDelete);

    if (deleteTelepastorsError) {
      throw new Error(
        `Failed to delete telepastors: ${deleteTelepastorsError.message}`,
      );
    }
  }

  const authUsers = await listAllAuthUsers(supabase);
  const authUsersToDelete = authUsers.filter((user) => {
    if (fullReset || !keepSuperAdmin) {
      return true;
    }

    return !preservedAuthUserIds.has(user.id);
  });

  for (const authUser of authUsersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);

    if (error) {
      throw new Error(
        `Failed to delete auth user ${authUser.email ?? authUser.id}: ${error.message}`,
      );
    }
  }

  if (fullReset || !keepSuperAdmin) {
    console.log("Database cleared completely (including super admin).");
    console.log("Run npm run bootstrap:super-admin before using the app again.");
    return;
  }

  console.log("Database cleared.");
  console.log(`Preserved ${preservedSuperAdminIds.size} super admin profile(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = process.env.SEED_FORCE === "true" || parseFlag("--force", args);
  const fullReset = parseFlag("--full", args);
  const keepSuperAdmin = !fullReset;

  if (!force && !parseFlag("--confirm", args)) {
    console.error(
      "This will delete ministry data from your Supabase project.",
    );
    console.error("Re-run with --confirm to proceed.");
    console.error("Optional flags:");
    console.error("  --full    Delete everything, including super admin");
    console.error("  --force   Allow running when NODE_ENV=production");
    process.exit(1);
  }

  assertDevOrForced(force);
  await clearOperationalData(fullReset, keepSuperAdmin);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
