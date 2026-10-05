import { StatCard } from "@/components/stats/stat-card";
import {
  getReachedContactCount,
  percentOf,
} from "@/lib/stats/compute";
import type { CampaignStatistics } from "@/types/domain";

export function ReportHeadlineStats({ stats }: { stats: CampaignStatistics }) {
  const called = stats.completed;
  const reached = getReachedContactCount(stats);
  const coming = stats.coming;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Total Called"
        value={called}
        suffix={`${percentOf(called, stats.totalContacts)}%`}
        highlight
        description="Individual contacts with a recorded response. % of all contacts."
      />
      <StatCard
        label="Total Reached"
        value={reached}
        suffix={`${percentOf(reached, called)}%`}
        description="Spoken to — Coming, Not Coming, Wrong Number, or Other. % of called."
      />
      <StatCard
        label="Total Coming"
        value={coming}
        suffix={`${percentOf(coming, called)}%`}
        description="Latest response marked Coming. % of called."
      />
    </div>
  );
}
