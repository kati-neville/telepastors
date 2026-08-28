import { Badge } from "@/components/ui/badge";
import { DistributionQuickAction } from "@/components/assignments/distribution-quick-action";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LeadershipDashboard } from "@/components/dashboard/leadership-dashboard";
import { TelepastorDashboard } from "@/components/calls/telepastor-dashboard";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { canDistributeContacts } from "@/lib/auth/assignments";
import { getRoleLabel } from "@/lib/auth/roles";
import { requireAuthSession } from "@/lib/auth/session";
import { fetchCallQueueStats } from "@/lib/queries/calls";
import { fetchDistributionSummary } from "@/lib/queries/assignments";
import {
	countContactsWithNotes,
	fetchLeadershipDashboard,
	fetchTelepastorRecentActivity,
} from "@/lib/queries/reports";
import { reportFilterSchema } from "@/lib/validations/reports";

type DashboardPageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
	params: Record<string, string | string[] | undefined>,
	key: string,
) {
	const value = params[key];
	return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
	searchParams,
}: DashboardPageProps) {
	const session = await requireAuthSession();
	const { telepastor } = session;
	const context = { telepastor };
	const resolvedSearchParams = await searchParams;

	const filters = reportFilterSchema.parse({
		campaignId: getParam(resolvedSearchParams, "campaignId"),
		governorId: getParam(resolvedSearchParams, "governorId"),
		leaderId: getParam(resolvedSearchParams, "leaderId"),
		telepastorId: getParam(resolvedSearchParams, "telepastorId"),
		response: getParam(resolvedSearchParams, "response"),
		from: getParam(resolvedSearchParams, "from"),
		to: getParam(resolvedSearchParams, "to"),
		view: getParam(resolvedSearchParams, "view"),
		hasNotes:
			getParam(resolvedSearchParams, "hasNotes") === "true"
				? "true"
				: undefined,
	});

	if (telepastor.role === "TELEPASTOR") {
		const [stats, recentActivity, contactsWithNotesCount] = await Promise.all([
			fetchCallQueueStats(context),
			fetchTelepastorRecentActivity(telepastor.id),
			countContactsWithNotes(context),
		]);

		return (
			<TelepastorDashboard
				stats={stats}
				telepastorName={telepastor.name}
				contactsWithNotesCount={contactsWithNotesCount}
				recentActivity={recentActivity}
			/>
		);
	}

	if (
		telepastor.role === "SUPER_ADMIN" ||
		telepastor.role === "GOVERNOR" ||
		telepastor.role === "LEADER"
	) {
		const [data, distributionSummary] = await Promise.all([
			fetchLeadershipDashboard(context, filters),
			canDistributeContacts(context)
				? fetchDistributionSummary(context)
				: Promise.resolve({ totalReady: 0, campaigns: [] }),
		]);

		return (
			<div className="space-y-6">
				<DistributionQuickAction
					totalReady={distributionSummary.totalReady}
					campaigns={distributionSummary.campaigns}
				/>
				<LeadershipDashboard
					data={data}
					role={telepastor.role}
					filters={filters}
					basePath="/dashboard"
				/>
			</div>
		);
	}

	return (
		<PlaceholderPage
			title="Dashboard"
			description="Your ministry workspace is ready.">
			<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Signed in as</CardTitle>
						<CardDescription>{session.loginIdentifier}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						<p className="font-medium">{telepastor.name}</p>
						<Badge variant="secondary">{getRoleLabel(telepastor.role)}</Badge>
					</CardContent>
				</Card>
			</div>
		</PlaceholderPage>
	);
}
