import { StatCard } from "@/components/stats/stat-card";
import { getRoleLabel } from "@/lib/auth/roles";
import type { TelepastorDirectoryCounts } from "@/lib/queries/telepastors";
import type { MinistryRole } from "@/types/domain";

const ROLE_ORDER: MinistryRole[] = [
	"GOVERNOR",
	"LEADER",
	"TELEPASTOR",
	"SUPER_ADMIN",
];

type TelepastorDirectoryStatsProps = {
	counts: TelepastorDirectoryCounts;
};

export function TelepastorDirectoryStats({
	counts,
}: TelepastorDirectoryStatsProps) {
	const roleCards = ROLE_ORDER.filter(
		role => role !== "SUPER_ADMIN" || counts.byRole.SUPER_ADMIN > 0,
	).map(role => ({
		role,
		label: getRoleLabel(role),
		value: counts.byRole[role],
	}));

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
			<StatCard
				label="Total"
				value={counts.total}
				description={`${counts.active} active · ${counts.inactive} inactive`}
				highlight
			/>
			{roleCards.map(card => (
				<StatCard key={card.role} label={card.label} value={card.value} />
			))}
		</div>
	);
}
