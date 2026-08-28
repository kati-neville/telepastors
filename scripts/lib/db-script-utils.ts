import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

type PublicTable = keyof Database["public"]["Tables"];

const NULL_UUID = "00000000-0000-0000-0000-000000000000";

export function assertDevOrForced(forceFlag: boolean) {
  if (process.env.NODE_ENV === "production" && !forceFlag) {
    throw new Error(
      "Refusing to run in production. Set SEED_FORCE=true to override.",
    );
  }
}

export function parseFlag(name: string, args: string[]): boolean {
  return args.includes(name);
}

export function parseNumberArg(
  args: string[],
  flag: string,
  fallback: number,
): number {
  const entry = args.find((arg) => arg.startsWith(`${flag}=`));

  if (!entry) {
    return fallback;
  }

  const value = Number(entry.split("=")[1]);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid value for ${flag}.`);
  }

  return value;
}

export async function deleteAllRows(
  supabase: SupabaseClient<Database, "public">,
  table: PublicTable,
) {
  const { error } = await supabase.from(table).delete().neq("id", NULL_UUID);

  if (error) {
    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }
}

export async function clearContactsAssignmentPointers(
  supabase: SupabaseClient<Database, "public">,
) {
  const { error } = await supabase
    .from("contacts")
    .update({
      current_assignee_id: null,
      current_assignment_id: null,
      assignment_status: "UNASSIGNED",
    })
    .neq("id", NULL_UUID);

  if (error) {
    throw new Error(`Failed to reset contact assignments: ${error.message}`);
  }
}

export async function listAllAuthUsers(
  supabase: SupabaseClient<Database, "public">,
) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    users.push(...data.users);

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function insertInBatches<T extends Record<string, unknown>>(
  supabase: SupabaseClient<Database, "public">,
  table: PublicTable,
  rows: T[],
  batchSize = 500,
) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from(table).insert(batch as never);

    if (error) {
      throw new Error(
        `Failed to insert into ${table} (batch ${index / batchSize + 1}): ${error.message}`,
      );
    }
  }
}
