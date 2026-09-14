import { requireAuthSession } from "@/lib/auth/session";
import { canAccessLeadershipReports } from "@/lib/auth/reports";
import { RecentActivityList } from "@/components/stats/recent-activity-list";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  fetchRecentActivityForContext,
  fetchReportFilterOptions,
} from "@/lib/queries/reports";
import { getReportScopeLabel } from "@/lib/auth/reports";
import { reportFilterSchema } from "@/lib/validations/reports";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
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
      getParam(resolvedSearchParams, "hasNotes") === "true" ? "true" : undefined,
  });

  const isLeadership = canAccessLeadershipReports(context);
  const role = session.telepastor.role as
    | "SUPER_ADMIN"
    | "GOVERNOR"
    | "LEADER"
    | "TELEPASTOR";

  const [activity, filterOptions] = await Promise.all([
    fetchRecentActivityForContext(context, filters),
    isLeadership
      ? fetchReportFilterOptions(context, filters)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Call activity
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLeadership
            ? `${getReportScopeLabel(role)} · recent call attempts across your scope.`
            : "Your recent call attempts, newest first."}
        </p>
      </div>

      {isLeadership && filterOptions ? (
        <Suspense fallback={<Skeleton className="ml-auto h-9 w-28 rounded-lg" />}>
          <ReportFilters
            filters={filters}
            options={filterOptions}
            role={role as "SUPER_ADMIN" | "GOVERNOR" | "LEADER"}
          />
        </Suspense>
      ) : null}

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-heading text-base font-semibold">
            {activity.length} recent {activity.length === 1 ? "activity" : "activities"}
          </h3>
        </div>
        <RecentActivityList activity={activity} />
      </div>
    </div>
  );
}
