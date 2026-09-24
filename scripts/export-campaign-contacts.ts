/**
 * Export campaign contacts to an Excel (.xlsx) file.
 *
 * READ-ONLY: selects contacts only. Never deletes or updates rows.
 *
 * Usage:
 *   npm run export:campaign-contacts -- --campaign=<uuid-or-name>
 *   npm run export:campaign-contacts -- --campaign="Swollen Sunday 2026" --out=./exports
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCampaignContactsExportBuffer,
  buildCampaignContactsExportFilename,
} from "../src/lib/excel/contact-export";
import { loadCampaignContactsForExport } from "../src/lib/contacts/load-campaign-contacts-export";
import { createServiceRoleClient } from "../src/lib/supabase/admin";

function parseArg(args: string[], flag: string): string | undefined {
  const prefixed = args.find((arg) => arg.startsWith(`${flag}=`));
  if (prefixed) {
    return prefixed.slice(flag.length + 1);
  }

  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1] && !args[index + 1]!.startsWith("--")) {
    return args[index + 1];
  }

  return undefined;
}

function printUsage() {
  console.log(`
Export campaign contacts to Excel (read-only).

Required:
  --campaign=<uuid|name>   Campaign id or exact/partial name

Optional:
  --out=<dir>              Output directory (default: ./exports)

Examples:
  npm run export:campaign-contacts -- --campaign=a8f01172-8766-4157-812b-513942e9dd15
  npm run export:campaign-contacts -- --campaign="Swollen Sunday" --out=./exports
`);
}

async function resolveCampaign(
  supabase: ReturnType<typeof createServiceRoleClient>,
  campaignArg: string,
) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(campaignArg)) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", campaignArg)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load campaign: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .ilike("name", `%${campaignArg}%`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to search campaigns: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (data.length > 1) {
    console.log("Multiple campaigns matched:");
    for (const campaign of data) {
      console.log(`  - ${campaign.name} (${campaign.id})`);
    }
    throw new Error("Pass a unique campaign name or the full campaign UUID.");
  }

  return data[0] ?? null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const campaignArg = parseArg(args, "--campaign");
  const outDir = parseArg(args, "--out") ?? "./exports";

  if (!campaignArg?.trim()) {
    printUsage();
    throw new Error("Missing --campaign=<uuid-or-name>");
  }

  const supabase = createServiceRoleClient();
  const campaign = await resolveCampaign(supabase, campaignArg.trim());

  if (!campaign) {
    throw new Error(`Campaign not found for: ${campaignArg}`);
  }

  console.log(
    `Exporting contacts for "${campaign.name}" (${campaign.id})...`,
  );
  console.log("Mode: READ-ONLY (no deletes or updates).");

  const rows = await loadCampaignContactsForExport(supabase, campaign.id);
  const buffer = buildCampaignContactsExportBuffer(rows);
  const filename = buildCampaignContactsExportFilename(campaign.name);
  const absoluteOutDir = path.resolve(process.cwd(), outDir);
  const filePath = path.join(absoluteOutDir, filename);

  await mkdir(absoluteOutDir, { recursive: true });
  await writeFile(filePath, Buffer.from(buffer));

  console.log(`Wrote ${rows.length} contacts to ${filePath}`);
  console.log("Contacts remain in the database unchanged.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
