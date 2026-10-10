import { Suspense } from "react";
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
import { IncompleteProfileBanner } from "@/components/profile/incomplete-profile-banner";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Skeleton } from "@/components/ui/skeleton";
import { canDistributeContacts } from "@/lib/auth/assignments";
import { getRoleLabel } from "@/lib/auth/roles";
import { requireAuthSession } from "@/lib/auth/session";
import { fetchCallQueueStats } from "@/lib/queries/calls";
import { fetchDistributionSummary } from "@/lib/queries/assignments";
import {
  countContactsWithNotes,
  fetchLeadershipDashboardShell,
  fetchLeadershipRecentActivity,
  fetchTeamPerformanceBundle,
  fetchTelepastorRecentActivity,
} from "@/lib/queries/reports";
import { RECENT_ACTIVITY_PREVIEW_LIMIT } from "@/lib/reports/recent-activity-limit";
import { getMissingProfileFields } from "@/lib/profile/completeness";
import { parseReportSearchParams } from "@/lib/reports/search-params";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import type { ReportFilterValues } from "@/lib/validations/reports";
import type { MinistryRole } from "@/types/domain";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const activity = await fetchLeadershipRecentActivity(
    context,
    filters,
    RECENT_ACTIVITY_PREVIEW_LIMIT,
  );
  return (
    <LeadershipRecentActivity activity={activity} filters={filters} />
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
  const filters = parseReportSearchParams(await searchParams);
  const profileBanner = (
    <IncompleteProfileBanner
      missingFields={getMissingProfileFields(telepastor)}
      href="/profile"
    />
  );

  if (telepastor.role === "TELEPASTOR") {
    const [stats, recentActivity, contactsWithNotesCount] = await Promise.all([
      fetchCallQueueStats(),
      fetchTelepastorRecentActivity(
        telepastor.id,
        RECENT_ACTIVITY_PREVIEW_LIMIT,
      ),
      countContactsWithNotes(context),
    ]);

    return (
      <div className="space-y-6">
        {profileBanner}
        <TelepastorDashboard
          stats={stats}
          telepastorName={telepastor.name}
          contactsWithNotesCount={contactsWithNotesCount}
          recentActivity={recentActivity}
        />
      </div>
    );
  }

  if (
    telepastor.role === "SUPER_ADMIN" ||
    telepastor.role === "GOVERNOR" ||
    telepastor.role === "LEADER"
  ) {
    return (
      <div className="space-y-6">
        {profileBanner}
        <LeadershipDashboardContent
          context={context}
          filters={filters}
          role={telepastor.role}
        />
      </div>
    );
  }

  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your ministry workspace is ready."
    >
      <div className="mt-6 space-y-6">
        {profileBanner}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>
    </PlaceholderPage>
  );
}
