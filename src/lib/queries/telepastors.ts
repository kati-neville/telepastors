import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import { applyTelepastorDirectoryFilters } from "@/lib/telepastors/directory-filters";
import { createClient } from "@/lib/supabase/server";
import type {
	MinistryRole,
	Telepastor,
	TelepastorDetail,
	TelepastorDirectoryEntry,
	TelepastorSummary,
} from "@/types/domain";
import type { TelepastorsFilterValues } from "@/lib/validations/telepastors";

export type TelepastorDirectoryCounts = {
	total: number;
	active: number;
	inactive: number;
	byRole: Record<MinistryRole, number>;
};

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

export function countTelepastorDirectory(
	entries: Pick<Telepastor, "role" | "is_active">[],
): TelepastorDirectoryCounts {
	const byRole: Record<MinistryRole, number> = {
		SUPER_ADMIN: 0,
		GOVERNOR: 0,
		LEADER: 0,
		TELEPASTOR: 0,
	};

	let active = 0;
	let inactive = 0;

	for (const entry of entries) {
		byRole[entry.role] += 1;
		if (entry.is_active) {
			active += 1;
		} else {
			inactive += 1;
		}
	}

	return {
		total: entries.length,
		active,
		inactive,
		byRole,
	};
}

async function fetchVisibleTelepastorsDirectory(): Promise<
	TelepastorDirectoryEntry[]
> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("telepastors")
		.select("*")
		.order("name", { ascending: true });

	if (error) {
		throw new Error(error.message);
	}

	return enrichDirectoryEntries(data ?? []);
}

export async function fetchTelepastorsDirectory(
	filters: TelepastorsFilterValues,
): Promise<TelepastorDirectoryEntry[]> {
	const enriched = await fetchVisibleTelepastorsDirectory();
	return applyTelepastorDirectoryFilters(enriched, filters);
}

export async function fetchTelepastorsDirectoryPage(
	filters: TelepastorsFilterValues = { role: "ALL", status: "all" },
): Promise<{
	telepastors: TelepastorDirectoryEntry[];
	counts: TelepastorDirectoryCounts;
}> {
	const enriched = await fetchVisibleTelepastorsDirectory();

	return {
		telepastors: applyTelepastorDirectoryFilters(enriched, filters),
		counts: countTelepastorDirectory(enriched),
	};
}

export async function fetchVisibleTelepastorsDirectoryEntries(): Promise<{
	telepastors: TelepastorDirectoryEntry[];
	counts: TelepastorDirectoryCounts;
}> {
	const telepastors = await fetchVisibleTelepastorsDirectory();
	return {
		telepastors,
		counts: countTelepastorDirectory(telepastors),
	};
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
