import { StatCard } from "@/components/stats/stat-card";
import type { CampaignStatistics } from "@/types/domain";

export function CampaignStatsOverview({ stats }: { stats: CampaignStatistics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      <StatCard label="Total contacts" value={stats.totalContacts} />
      <StatCard label="Assigned" value={stats.assigned} />
      <StatCard label="Unassigned" value={stats.unassigned} />
      <StatCard label="Completed" value={stats.completed} highlight />
      <StatCard label="Remaining" value={stats.remaining} />
      <StatCard label="Call attempts" value={stats.totalCallAttempts} description="Total attempts (not unique contacts)" />
      <StatCard label="Completion" value={stats.completionPercentage} suffix="%" />
      <StatCard label="Reach rate" value={stats.reachRate} suffix="%" description="Excludes unreachable" />
      <StatCard label="Coming rate" value={stats.comingPercentage} suffix="%" description="Of completed contacts" />
    </div>
  );
}
