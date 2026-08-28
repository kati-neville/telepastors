import Link from "next/link";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { CampaignStatsOverview } from "@/components/stats/campaign-stats-overview";
import { RecentActivityPanel } from "@/components/stats/recent-activity-panel";
import { ResponseBreakdown } from "@/components/stats/response-breakdown";
import { TeamPerformanceSection } from "@/components/reports/team-performance-section";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stats/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadershipDashboardData, MinistryRole } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

export function LeadershipDashboard({
  data,
  role,
  filters,
  basePath,
  showFullReportsLink = true,
  showHeader = true,
}: {
  data: LeadershipDashboardData;
  role: MinistryRole;
  filters: ReportFilterValues;
  basePath: string;
  showFullReportsLink?: boolean;
  showHeader?: boolean;
}) {
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active campaigns" value={data.activeCampaigns} />
        <StatCard
          label="Total call attempts"
          value={data.stats.totalCallAttempts}
          description="Includes repeat attempts"
        />
        <StatCard
          label="Completion"
          value={data.stats.completionPercentage}
          suffix="%"
          highlight
        />
        <StatCard
          label="Reach rate"
          value={data.stats.reachRate}
          suffix="%"
        />
      </div>

      <CampaignStatsOverview stats={data.stats} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ResponseBreakdown stats={data.stats} />
        <RecentActivityPanel activity={data.recentActivity} />
      </div>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <TeamPerformanceSection
          rows={data.teamPerformance}
          view={data.teamPerformanceView}
          role={role}
          filters={filters}
          basePath={basePath}
          filterOptions={data.filterOptions}
        />
      </Suspense>
    </div>
  );
}
