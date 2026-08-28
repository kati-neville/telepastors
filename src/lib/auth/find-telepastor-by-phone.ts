import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone/normalize";
import type { Database } from "@/types/database";

type TelepastorLoginRow = {
  id: string;
  auth_user_id: string | null;
  is_active: boolean;
  phone: string;
  phone_normalized: string | null;
};

export async function findTelepastorByNormalizedPhone(
  supabase: SupabaseClient<Database>,
  normalizedPhone: string,
): Promise<TelepastorLoginRow | null> {
  const { data: directMatch, error: directError } = await supabase
    .from("telepastors")
    .select("id, auth_user_id, is_active, phone, phone_normalized")
    .eq("phone_normalized", normalizedPhone)
    .maybeSingle();

  if (directError) {
    throw new Error(directError.message);
  }

  if (directMatch) {
    return directMatch;
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from("telepastors")
    .select("id, auth_user_id, is_active, phone, phone_normalized")
    .not("auth_user_id", "is", null);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  for (const candidate of candidates ?? []) {
    const normalized = normalizePhone(candidate.phone);

    if (normalized.ok && normalized.normalized === normalizedPhone) {
      return candidate;
    }
  }

  return null;
}
