import { Suspense } from "react";
import { requireReportsAccess } from "@/app/actions/reports";
import { LeadershipDashboard } from "@/components/dashboard/leadership-dashboard";
import { ExportTeamPerformanceButton } from "@/components/reports/export-team-performance-button";
import { ReportFilters } from "@/components/reports/report-filters";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchLeadershipDashboard } from "@/lib/queries/reports";
import { reportFilterSchema } from "@/lib/validations/reports";

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  const { session, context } = await requireReportsAccess();

  const filters = reportFilterSchema.parse({
    campaignId: getParam(resolvedSearchParams, "campaignId"),
    governorId: getParam(resolvedSearchParams, "governorId"),
    leaderId: getParam(resolvedSearchParams, "leaderId"),
    telepastorId: getParam(resolvedSearchParams, "telepastorId"),
    response: getParam(resolvedSearchParams, "response"),
    from: getParam(resolvedSearchParams, "from"),
    to: getParam(resolvedSearchParams, "to"),
    view: getParam(resolvedSearchParams, "view"),
    hasNotes: getParam(resolvedSearchParams, "hasNotes") === "true" ? "true" : undefined,
  });

  const data = await fetchLeadershipDashboard(context, filters);
  const role = session.telepastor.role as "SUPER_ADMIN" | "GOVERNOR" | "LEADER";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Campaign and team statistics for {data.scopeLabel.toLowerCase()}.
          </p>
        </div>
        <ExportTeamPerformanceButton filters={filters} />
      </div>

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <ReportFilters
          filters={filters}
          options={data.filterOptions}
          role={role}
        />
      </Suspense>

      <LeadershipDashboard
        data={data}
        role={role}
        filters={filters}
        basePath="/reports"
        showFullReportsLink={false}
        showHeader={false}
      />
    </div>
  );
}
