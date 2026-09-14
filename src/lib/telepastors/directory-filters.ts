import type { TelepastorDirectoryEntry } from "@/types/domain";
import type { TelepastorsFilterValues } from "@/lib/validations/telepastors";

export function applyTelepastorDirectoryFilters(
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
