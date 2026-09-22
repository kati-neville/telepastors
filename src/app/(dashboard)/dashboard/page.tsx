import { Suspense, cache } from "react";
import { Badge } from "@/components/ui/badge";
import { DistributionQuickAction } from "@/components/assignments/distribution-quick-action";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LeadershipDashboardStats,
  LeadershipRecentActivity,
  LeadershipTeamPerformance,
  RecentActivitySkeleton,
  TeamPerformanceSkeleton,
} from "@/components/dashboard/leadership-dashboard";
import { TelepastorDashboard } from "@/components/calls/telepastor-dashboard";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Skeleton } from "@/components/ui/skeleton";
import { canDistributeContacts } from "@/lib/auth/assignments";
import { getRoleLabel } from "@/lib/auth/roles";
import { requireAuthSession } from "@/lib/auth/session";
import { fetchCallQueueStats } from "@/lib/queries/calls";
import { fetchDistributionSummary } from "@/lib/queries/assignments";
import {
  countContactsWithNotes,
  fetchLeadershipDashboardExtras,
  fetchLeadershipDashboardShell,
  fetchTelepastorRecentActivity,
} from "@/lib/queries/reports";
import { RECENT_ACTIVITY_PREVIEW_LIMIT } from "@/lib/reports/recent-activity-limit";
import { reportFilterSchema } from "@/lib/validations/reports";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import type { ReportFilterValues } from "@/lib/validations/reports";
import type { MinistryRole } from "@/types/domain";

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

const getLeadershipExtras = cache(
  (context: AuthorizationContext, filters: ReportFilterValues) =>
    fetchLeadershipDashboardExtras(context, filters),
);

async function DistributionQuickActionSection({
  context,
}: {
  context: AuthorizationContext;
}) {
  if (!canDistributeContacts(context)) {
    return null;
  }

  const distributionSummary = await fetchDistributionSummary(context);
  return (
    <DistributionQuickAction
      totalReady={distributionSummary.totalReady}
      campaigns={distributionSummary.campaigns}
    />
  );
}

async function LeadershipRecentActivitySection({
  context,
  filters,
}: {
  context: AuthorizationContext;
  filters: ReportFilterValues;
}) {
  const extras = await getLeadershipExtras(context, filters);
  return (
    <LeadershipRecentActivity
      activity={extras.recentActivity}
      filters={filters}
    />
  );
}

async function LeadershipTeamPerformanceSection({
  context,
  filters,
  role,
  filterOptions,
}: {
  context: AuthorizationContext;
  filters: ReportFilterValues;
  role: MinistryRole;
  filterOptions: Awaited<
    ReturnType<typeof fetchLeadershipDashboardShell>
  >["filterOptions"];
}) {
  const extras = await getLeadershipExtras(context, filters);
  return (
    <LeadershipTeamPerformance
      bundle={extras.teamPerformanceBundle}
      role={role}
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}

async function LeadershipDashboardContent({
  context,
  filters,
  role,
}: {
  context: AuthorizationContext;
  filters: ReportFilterValues;
  role: MinistryRole;
}) {
  const shell = await fetchLeadershipDashboardShell(context, filters);

  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <DistributionQuickActionSection context={context} />
      </Suspense>

      <LeadershipDashboardStats
        data={shell}
        filters={filters}
        recentActivity={
          <Suspense fallback={<RecentActivitySkeleton />}>
            <LeadershipRecentActivitySection
              context={context}
              filters={filters}
            />
          </Suspense>
        }
        teamPerformance={
          <Suspense fallback={<TeamPerformanceSkeleton />}>
            <LeadershipTeamPerformanceSection
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
      fetchTelepastorRecentActivity(
        telepastor.id,
        RECENT_ACTIVITY_PREVIEW_LIMIT,
      ),
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
    return (
      <LeadershipDashboardContent
        context={context}
        filters={filters}
        role={telepastor.role}
      />
    );
  }

  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your ministry workspace is ready."
    >
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
