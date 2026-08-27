import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { CampaignStatsOverview } from "@/components/stats/campaign-stats-overview";
import { RecentActivityPanel } from "@/components/stats/recent-activity-panel";
import { ResponseBreakdown } from "@/components/stats/response-breakdown";
import { TeamPerformancePanel } from "@/components/reports/team-performance-panel";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stats/stat-card";
import type { LeadershipDashboardData } from "@/types/domain";

export function LeadershipDashboard({
  data,
  showFullReportsLink = true,
  performanceTitle,
}: {
  data: LeadershipDashboardData;
  showFullReportsLink?: boolean;
  performanceTitle: string;
}) {
  return (
    <div className="space-y-6">
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

      <TeamPerformancePanel rows={data.teamPerformance} title={performanceTitle} />
    </div>
  );
}
