import { TelepastorsDirectoryClient } from "@/components/telepastors/telepastors-directory-client";
import { enforcePageAccess } from "@/lib/auth/guards";
import {
	canBulkImportTelepastors,
	canCreateTelepastor,
} from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import {
	fetchGovernorOptions,
	fetchLeaderOptions,
	fetchVisibleTelepastorsDirectoryEntries,
} from "@/lib/queries/telepastors";

export default async function TelepastorsPage() {
	await enforcePageAccess("/telepastors");
	const session = await requireAuthSession();

	const [{ telepastors, counts }, governors, leaders] = await Promise.all([
		fetchVisibleTelepastorsDirectoryEntries(),
		session.telepastor.role === "SUPER_ADMIN"
			? fetchGovernorOptions()
			: Promise.resolve([]),
		fetchLeaderOptions(
			session.telepastor.role === "GOVERNOR"
				? session.telepastor.id
				: undefined,
		),
	]);

	return (
		<TelepastorsDirectoryClient
			telepastors={telepastors}
			counts={counts}
			viewerRole={session.telepastor.role}
			governors={governors}
			leaders={leaders}
			canCreate={canCreateTelepastor({ telepastor: session.telepastor })}
			canImport={canBulkImportTelepastors({
				telepastor: session.telepastor,
			})}
		/>
	);
}
