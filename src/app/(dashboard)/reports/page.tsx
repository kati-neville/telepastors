import { Suspense } from "react";
import { requireReportsAccess } from "@/app/actions/reports";
import {
  LeadershipDashboardStats,
  LeadershipRecentActivity,
  LeadershipTeamPerformance,
  RecentActivitySkeleton,
  TeamPerformanceSkeleton,
} from "@/components/dashboard/leadership-dashboard";
import { ExportTeamPerformanceButton } from "@/components/reports/export-team-performance-button";
import { ReportFilters } from "@/components/reports/report-filters";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import {
  fetchLeadershipDashboardShell,
  fetchLeadershipRecentActivity,
  fetchTeamPerformanceBundle,
  type LeadershipDashboardShellData,
} from "@/lib/queries/reports";
import { parseReportSearchParams } from "@/lib/reports/search-params";
import { RECENT_ACTIVITY_PREVIEW_LIMIT } from "@/lib/reports/recent-activity-limit";
import type { ReportFilterValues } from "@/lib/validations/reports";
import type { MinistryRole } from "@/types/domain";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function ReportsRecentActivity({
  context,
  filters,
}: {
  context: AuthorizationContext;
  filters: ReportFilterValues;
}) {
  const activity = await fetchLeadershipRecentActivity(
    context,
    filters,
    RECENT_ACTIVITY_PREVIEW_LIMIT,
  );
  return <LeadershipRecentActivity activity={activity} filters={filters} />;
}

async function ReportsTeamPerformance({
  context,
  filters,
  role,
  filterOptions,
}: {
  context: AuthorizationContext;
  filters: ReportFilterValues;
  role: MinistryRole;
  filterOptions: LeadershipDashboardShellData["filterOptions"];
}) {
  const bundle = await fetchTeamPerformanceBundle(context, filters);
  return (
    <LeadershipTeamPerformance
      bundle={bundle}
      role={role}
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { session, context } = await requireReportsAccess();
  const filters = parseReportSearchParams(await searchParams);
  const role = session.telepastor.role as "SUPER_ADMIN" | "GOVERNOR" | "LEADER";
  const shell = await fetchLeadershipDashboardShell(context, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Campaign and team statistics for {shell.scopeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportFilters
            filters={filters}
            options={shell.filterOptions}
            role={role}
          />
          <ExportTeamPerformanceButton filters={filters} />
        </div>
      </div>

      <LeadershipDashboardStats
        data={shell}
        filters={filters}
        showFullReportsLink={false}
        showHeader={false}
        variant="reports"
        recentActivity={
          <Suspense fallback={<RecentActivitySkeleton />}>
            <ReportsRecentActivity context={context} filters={filters} />
          </Suspense>
        }
        teamPerformance={
          <Suspense fallback={<TeamPerformanceSkeleton />}>
            <ReportsTeamPerformance
              context={context}
              filters={filters}
              role={role}
              filterOptions={shell.filterOptions}
            />
          </Suspense>
        }
      />
    </div>
  );
}
