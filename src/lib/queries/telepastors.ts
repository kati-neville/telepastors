import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type {
  Telepastor,
  TelepastorDetail,
  TelepastorDirectoryEntry,
  TelepastorSummary,
} from "@/types/domain";
import type { TelepastorsFilterValues } from "@/lib/validations/telepastors";

function enrichDirectoryEntries(
  telepastors: Telepastor[],
): TelepastorDirectoryEntry[] {
  const byId = new Map(telepastors.map((entry) => [entry.id, entry]));

  return telepastors.map((entry) => {
    const leader = entry.leader_id ? byId.get(entry.leader_id) : undefined;
    const governorId =
      entry.role === "LEADER"
        ? entry.governor_id
        : getGovernorIdForTelepastor(entry, leader);

    const governor = governorId ? byId.get(governorId) : undefined;

    return {
      ...entry,
      leader_name: leader?.name ?? null,
      governor_name: governor?.name ?? null,
    };
  });
}

function applyDirectoryFilters(
  entries: TelepastorDirectoryEntry[],
  filters: TelepastorsFilterValues,
): TelepastorDirectoryEntry[] {
  const query = filters.q?.trim().toLowerCase() ?? "";
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return entries.filter((entry) => {
    if (query) {
      const matchesName = entry.name.toLowerCase().includes(query);
      const matchesPhone = entry.phone.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone) {
        return false;
      }
    }

    if (filters.role !== "ALL" && entry.role !== filters.role) {
      return false;
    }

    if (filters.status === "active" && !entry.is_active) {
      return false;
    }

    if (filters.status === "inactive" && entry.is_active) {
      return false;
    }

    if (filters.governor) {
      const governorId = filters.governor;
      const inGovernorOrg =
        entry.id === governorId ||
        (entry.role === "LEADER" && entry.governor_id === governorId) ||
        (entry.role === "TELEPASTOR" &&
          (entry.governor_id === governorId ||
            (entry.leader_id != null &&
              byId.get(entry.leader_id)?.governor_id === governorId)));

      if (!inGovernorOrg) {
        return false;
      }
    }

    if (filters.leader) {
      const inLeaderTeam =
        entry.id === filters.leader ||
        (entry.role === "TELEPASTOR" && entry.leader_id === filters.leader);

      if (!inLeaderTeam) {
        return false;
      }
    }

    return true;
  });
}

export async function fetchTelepastorsDirectory(
  filters: TelepastorsFilterValues,
): Promise<TelepastorDirectoryEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("telepastors")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const enriched = enrichDirectoryEntries(data ?? []);
  return applyDirectoryFilters(enriched, filters);
}

export async function fetchTelepastorById(
  id: string,
): Promise<TelepastorDetail | null> {
  const supabase = await createClient();

  const { data: telepastor, error } = await supabase
    .from("telepastors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!telepastor) {
    return null;
  }

  const relatedIds = [telepastor.leader_id, telepastor.governor_id].filter(
    (value): value is string => Boolean(value),
  );

  let leader: TelepastorSummary | null = null;
  let governor: TelepastorSummary | null = null;

  if (telepastor.leader_id) {
    const { data } = await supabase
      .from("telepastors")
      .select("id, name, role, governor_id, leader_id")
      .eq("id", telepastor.leader_id)
      .maybeSingle();

    leader = data;
  }

  const governorId =
    telepastor.role === "LEADER"
      ? telepastor.governor_id
      : getGovernorIdForTelepastor(telepastor, leader);

  if (governorId && !relatedIds.includes(governorId)) {
    relatedIds.push(governorId);
  }

  if (governorId) {
    const { data } = await supabase
      .from("telepastors")
      .select("id, name, role, governor_id, leader_id")
      .eq("id", governorId)
      .maybeSingle();

    governor = data;
  }

  return {
    ...telepastor,
    leader,
    governor,
  };
}

export async function fetchGovernorOptions(): Promise<TelepastorSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id")
    .eq("role", "GOVERNOR")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchLeaderOptions(
  governorId?: string,
): Promise<TelepastorSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id")
    .eq("role", "LEADER")
    .eq("is_active", true)
    .order("name");

  if (governorId) {
    query = query.eq("governor_id", governorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function getPublicProfilePhotoUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/storage/v1/object/public/profile-pictures/${path}`;
}
