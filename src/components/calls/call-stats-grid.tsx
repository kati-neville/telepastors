import { StatCard } from "@/components/stats/stat-card";
import type { CallQueueStats } from "@/types/domain";

export function CallStatsGrid({ stats }: { stats: CallQueueStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      <StatCard label="Assigned" value={stats.assigned} />
      <StatCard label="Completed" value={stats.completed} highlight />
      <StatCard label="Remaining" value={stats.remaining} />
      <StatCard label="Coming" value={stats.coming} />
      <StatCard label="Not Coming" value={stats.notComing} />
      <StatCard label="Unreachable" value={stats.unreachable} />
    </div>
  );
}
