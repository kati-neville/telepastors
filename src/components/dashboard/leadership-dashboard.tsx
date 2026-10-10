import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { CampaignStatsOverview } from "@/components/stats/campaign-stats-overview";
import { RecentActivityPanel } from "@/components/stats/recent-activity-panel";
import { ResponseBreakdown } from "@/components/stats/response-breakdown";
import { ReportHeadlineStats } from "@/components/reports/report-headline-stats";
import { TeamPerformanceSection } from "@/components/reports/team-performance-section";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stats/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildContactsWithNotesHref } from "@/lib/reports/contacts-with-notes-url";
import { buildActivityHref } from "@/lib/reports/activity-url";
import type { LeadershipDashboardShellData } from "@/lib/queries/reports";
import type {
	MinistryRole,
	RecentCallActivity,
	ReportFilterOptions,
	TeamPerformanceBundle,
} from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

export function LeadershipDashboardStats({
	data,
	filters,
	showFullReportsLink = true,
	showHeader = true,
	variant = "dashboard",
	recentActivity,
	teamPerformance,
}: {
	data: LeadershipDashboardShellData;
	filters: ReportFilterValues;
	showFullReportsLink?: boolean;
	showHeader?: boolean;
	variant?: "dashboard" | "reports";
	recentActivity: React.ReactNode;
	teamPerformance: React.ReactNode;
}) {
	const contactsWithNotesHref = buildContactsWithNotesHref(filters);
	const isReports = variant === "reports";

	return (
		<div className="space-y-6">
			{showHeader ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="font-heading text-2xl font-semibold tracking-tight">
							Dashboard
						</h2>
						<p className="text-sm text-muted-foreground">
							{data.scopeLabel} · unique contact statistics based on latest
							response.
						</p>
					</div>
					{showFullReportsLink ? (
						<Button variant="outline" render={<Link href="/reports" />}>
							<BarChart3 />
							Full reports
						</Button>
					) : null}
				</div>
			) : null}

			<ReportHeadlineStats
				stats={data.stats}
				size={isReports ? "default" : "lg"}
			/>

			<CampaignStatsOverview
				stats={data.stats}
				contactsWithNotesCount={data.contactsWithNotesCount}
				contactsWithNotesHref={contactsWithNotesHref}
				showRates={false}
				extraCards={
					<StatCard label="Active campaigns" value={data.activeCampaigns} />
				}
			/>

			<div className="grid gap-6 xl:grid-cols-2">
				<ResponseBreakdown stats={data.stats} />
				{recentActivity}
			</div>

			{teamPerformance}
		</div>
	);
}

export function RecentActivitySkeleton() {
	return <Skeleton className="h-64 w-full rounded-xl" />;
}

export function TeamPerformanceSkeleton() {
	return <Skeleton className="h-48 w-full rounded-xl" />;
}

export function LeadershipRecentActivity({
	activity,
	filters,
}: {
	activity: RecentCallActivity[];
	filters: ReportFilterValues;
}) {
	return (
		<RecentActivityPanel
			activity={activity}
			viewAllHref={buildActivityHref(filters)}
		/>
	);
}

export function LeadershipTeamPerformance({
	bundle,
	role,
	filters,
	filterOptions,
}: {
	bundle: TeamPerformanceBundle;
	role: MinistryRole;
	filters: ReportFilterValues;
	filterOptions: ReportFilterOptions;
}) {
	return (
		<TeamPerformanceSection
			bundle={bundle}
			role={role}
			filters={filters}
			filterOptions={filterOptions}
		/>
	);
}
