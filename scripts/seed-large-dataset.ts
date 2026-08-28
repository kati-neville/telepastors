import "dotenv/config";
import { DEFAULT_TELEPASTOR_PASSWORD } from "../src/lib/auth/default-password";
import { provisionTelepastorAuthUser } from "../src/lib/auth/provision-auth-user";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import { getTelepastorPhoneNormalized } from "../src/lib/telepastors/phone";
import { normalizePhone } from "../src/lib/phone/normalize";
import type { Database } from "../src/types/database";
import {
  assertDevOrForced,
  insertInBatches,
  parseFlag,
  parseNumberArg,
} from "./lib/db-script-utils";

const GOVERNOR_COUNT = 4;
const LEADERS_PER_GOVERNOR = 2;
const TELEPASTORS_PER_LEADER = 8;
const DEFAULT_CONTACT_COUNT = 1200;
const CONTACT_BATCH_SIZE = 500;

type MinistryRole = Database["public"]["Tables"]["telepastors"]["Row"]["role"];

type CreatedMember = {
  id: string;
  name: string;
  role: MinistryRole;
  phone: string;
  governorId: string | null;
  leaderId: string | null;
};

function formatLocalPhone(prefix: string, suffix: number) {
  const phone = `${prefix}${String(suffix).padStart(10 - prefix.length, "0")}`;

  if (phone.length !== 10) {
    throw new Error(`Invalid generated phone: ${phone}`);
  }

  return phone;
}

function buildGovernorPhone(governorIndex: number) {
  return formatLocalPhone("028000000", governorIndex);
}

function buildLeaderPhone(governorIndex: number, leaderIndex: number) {
  return formatLocalPhone("0280000", 100 + (governorIndex - 1) * 10 + leaderIndex);
}

function buildTelepastorPhone(
  governorIndex: number,
  leaderIndex: number,
  telepastorIndex: number,
) {
  return formatLocalPhone(
    "028000",
    1000 + (governorIndex - 1) * 100 + (leaderIndex - 1) * 10 + telepastorIndex,
  );
}

function buildContactPhone(index: number) {
  return formatLocalPhone("055", index);
}

async function getSuperAdminId() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name")
    .eq("role", "SUPER_ADMIN")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "No SUPER_ADMIN found. Run npm run bootstrap:super-admin first.",
    );
  }

  return data;
}

async function createMember(input: {
  name: string;
  role: MinistryRole;
  phone: string;
  address: string;
  governorId?: string | null;
  leaderId?: string | null;
}): Promise<CreatedMember> {
  const supabase = createServiceRoleClient();
  const phoneNormalized = getTelepastorPhoneNormalized(input.phone);

  const { data, error } = await supabase
    .from("telepastors")
    .insert({
      name: input.name,
      phone: input.phone,
      phone_normalized: phoneNormalized,
      address: input.address,
      role: input.role,
      governor_id: input.governorId ?? null,
      leader_id: input.leaderId ?? null,
      is_active: true,
      must_change_password: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create ${input.name}: ${error?.message ?? "Unknown error"}`);
  }

  const { authUserId } = await provisionTelepastorAuthUser({
    telepastorId: data.id,
    phoneNormalized,
    password: DEFAULT_TELEPASTOR_PASSWORD,
  });

  const { error: linkError } = await supabase
    .from("telepastors")
    .update({ auth_user_id: authUserId })
    .eq("id", data.id);

  if (linkError) {
    throw new Error(`Failed to link auth account for ${input.name}: ${linkError.message}`);
  }

  return {
    id: data.id,
    name: input.name,
    role: input.role,
    phone: input.phone,
    governorId: input.governorId ?? null,
    leaderId: input.leaderId ?? null,
  };
}

async function seedHierarchy() {
  const governors: CreatedMember[] = [];
  const leaders: CreatedMember[] = [];
  const telepastors: CreatedMember[] = [];

  console.log("Creating governors...");
  for (let governorIndex = 1; governorIndex <= GOVERNOR_COUNT; governorIndex += 1) {
    const governor = await createMember({
      name: `Governor ${governorIndex}`,
      role: "GOVERNOR",
      phone: buildGovernorPhone(governorIndex),
      address: `Governor ${governorIndex} Office`,
    });
    governors.push(governor);
    console.log(`  ${governor.name} (${governor.phone})`);
  }

  console.log("Creating leaders...");
  for (const governor of governors) {
    const governorNumber = Number(governor.name.split(" ")[1]);

    for (let leaderIndex = 1; leaderIndex <= LEADERS_PER_GOVERNOR; leaderIndex += 1) {
      const leader = await createMember({
        name: `Leader ${governorNumber}-${leaderIndex}`,
        role: "LEADER",
        phone: buildLeaderPhone(governorNumber, leaderIndex),
        address: `Leader ${governorNumber}-${leaderIndex} Office`,
        governorId: governor.id,
      });
      leaders.push(leader);
      console.log(`  ${leader.name} (${leader.phone})`);
    }
  }

  console.log("Creating telepastors...");
  for (const leader of leaders) {
    const [, governorNumber, leaderNumber] = leader.name.match(/^Leader (\d+)-(\d+)$/) ?? [];

    if (!governorNumber || !leaderNumber) {
      throw new Error(`Unexpected leader name format: ${leader.name}`);
    }

    for (
      let telepastorIndex = 1;
      telepastorIndex <= TELEPASTORS_PER_LEADER;
      telepastorIndex += 1
    ) {
      const telepastor = await createMember({
        name: `Telepastor ${governorNumber}-${leaderNumber}-${telepastorIndex}`,
        role: "TELEPASTOR",
        phone: buildTelepastorPhone(
          Number(governorNumber),
          Number(leaderNumber),
          telepastorIndex,
        ),
        address: `Telepastor ${governorNumber}-${leaderNumber}-${telepastorIndex} Address`,
        leaderId: leader.id,
      });
      telepastors.push(telepastor);
    }
  }

  console.log(`  Created ${telepastors.length} telepastors.`);

  return { governors, leaders, telepastors };
}

async function createSeedCampaign(
  createdBy: string,
  contactCount: number,
  campaignName: string,
) {
  const supabase = createServiceRoleClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      name: campaignName,
      description: `Generated dataset with ${contactCount} contacts`,
      status: "ACTIVE",
      event_date: new Date().toISOString().slice(0, 10),
      created_by: createdBy,
    })
    .select("id, name")
    .single();

  if (campaignError || !campaign) {
    throw new Error(
      `Failed to create campaign: ${campaignError?.message ?? "Unknown error"}`,
    );
  }

  console.log(`Created campaign: ${campaign.name} (${campaign.id})`);
  return campaign;
}

async function seedContacts(
  campaignId: string,
  contactCount: number,
  importedBy: string,
) {
  const supabase = createServiceRoleClient();
  const rows = [];

  for (let index = 1; index <= contactCount; index += 1) {
    const phone = buildContactPhone(index);
    const normalized = normalizePhone(phone);

    if (!normalized.ok) {
      throw new Error(`Invalid generated contact phone at index ${index}: ${phone}`);
    }

    rows.push({
      campaign_id: campaignId,
      name: `Contact ${String(index).padStart(4, "0")}`,
      phone,
      phone_normalized: normalized.normalized,
      assignment_status: "UNASSIGNED" as const,
      held_for_own_calls: false,
    });
  }

  const { data: importRecord, error: importError } = await supabase
    .from("contact_imports")
    .insert({
      campaign_id: campaignId,
      imported_by: importedBy,
      file_name: "seed-large-dataset.generated.csv",
      status: "COMPLETED",
      total_rows: contactCount,
      valid_rows: contactCount,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: contactCount,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (importError || !importRecord) {
    throw new Error(
      `Failed to create import record: ${importError?.message ?? "Unknown error"}`,
    );
  }

  const rowsWithImport = rows.map((row, index) => ({
    ...row,
    import_id: importRecord.id,
    import_row_number: index + 1,
  }));

  console.log(`Inserting ${contactCount} contacts into campaign ${campaignId}...`);
  await insertInBatches(supabase, "contacts", rowsWithImport, CONTACT_BATCH_SIZE);
}

async function main() {
  const args = process.argv.slice(2);
  const force = process.env.SEED_FORCE === "true" || parseFlag("--force", args);
  const contactCount = parseNumberArg(
    args,
    "--contacts",
    Number(process.env.SEED_CONTACT_COUNT ?? DEFAULT_CONTACT_COUNT),
  );
  const campaignName =
    args.find((arg) => arg.startsWith("--campaign-name="))?.split("=")[1] ??
    process.env.SEED_CAMPAIGN_NAME ??
    "Large Seed Campaign";

  if (contactCount < 1000) {
    throw new Error("Contact count must be at least 1000.");
  }

  assertDevOrForced(force);

  const superAdmin = await getSuperAdminId();

  console.log(`Using super admin: ${superAdmin.name}`);

  const campaign = await createSeedCampaign(
    superAdmin.id,
    contactCount,
    campaignName,
  );

  const hierarchy = await seedHierarchy();

  await seedContacts(campaign.id, contactCount, superAdmin.id);

  console.log("\nLarge seed complete.");
  console.log(`Campaign: ${campaign.name}`);
  console.log(`Campaign ID: ${campaign.id}`);
  console.log(`Campaign URL path: /campaigns/${campaign.id}`);
  console.log(`Contacts: ${contactCount}`);
  console.log(`Governors: ${hierarchy.governors.length}`);
  console.log(`Leaders: ${hierarchy.leaders.length}`);
  console.log(`Telepastors: ${hierarchy.telepastors.length}`);
  console.log("\nSign-in details for seeded ministry members:");
  console.log(`  Password: ${DEFAULT_TELEPASTOR_PASSWORD}`);
  console.log("  Governors:");
  for (const governor of hierarchy.governors) {
    console.log(`    ${governor.name}: ${governor.phone}`);
  }
  console.log("  Example leader: " + hierarchy.leaders[0]?.phone);
  console.log("  Example telepastor: " + hierarchy.telepastors[0]?.phone);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
