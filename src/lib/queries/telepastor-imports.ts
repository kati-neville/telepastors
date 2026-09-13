import { createClient } from "@/lib/supabase/server";
import type { TelepastorImport } from "@/types/domain";
import type { TelepastorImportLookupMaps } from "@/lib/excel/parse-telepastors";

export async function fetchExistingTelepastorNormalizedPhones(): Promise<
  Set<string>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("phone_normalized")
    .not("phone_normalized", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.phone_normalized)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function fetchTelepastorImportLookups(): Promise<TelepastorImportLookupMaps> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id, phone_normalized")
    .in("role", ["GOVERNOR", "LEADER"])
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const byPhone = new Map<
    string,
    {
      id: string;
      name: string;
      role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER" | "TELEPASTOR";
      governor_id: string | null;
      leader_id: string | null;
      phone_normalized: string | null;
    }
  >();

  for (const row of data ?? []) {
    if (!row.phone_normalized) continue;
    byPhone.set(row.phone_normalized, row);
  }

  return { byPhone };
}

export async function fetchTelepastorImportById(
  importId: string,
): Promise<TelepastorImport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastor_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function fetchRecentTelepastorImports(
  limit = 10,
): Promise<TelepastorImport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastor_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
