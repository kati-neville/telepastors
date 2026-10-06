import { StatCard } from "@/components/stats/stat-card";
import {
  getReachedContactCount,
  percentOf,
} from "@/lib/stats/compute";
import type { CampaignStatistics } from "@/types/domain";

type HeadlineStats = Pick<
  CampaignStatistics,
  "completed" | "coming" | "notComing" | "wrongNumber" | "other" | "totalContacts"
>;

export function ReportHeadlineStats({
  stats,
  size = "default",
}: {
  stats: HeadlineStats;
  size?: "default" | "lg";
}) {
  const called = stats.completed;
  const reached = getReachedContactCount(stats);
  const coming = stats.coming;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Total called"
        value={called}
        suffix={`${percentOf(called, stats.totalContacts)}%`}
        highlight
        size={size}
        description="Contacts with a recorded response. % of all contacts."
      />
      <StatCard
        label="Reached"
        value={reached}
        suffix={`${percentOf(reached, called)}%`}
        size={size}
        description="Spoken to — Coming, Not Coming, Wrong Number, or Other. % of called."
      />
      <StatCard
        label="Coming"
        value={coming}
        suffix={`${percentOf(coming, called)}%`}
        size={size}
        description="Latest response marked Coming. % of called."
      />
    </div>
  );
}
