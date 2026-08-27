import Link from "next/link";
import { List, PhoneCall } from "lucide-react";
import { CallStatsGrid } from "@/components/calls/call-stats-grid";
import { RecentActivityPanel } from "@/components/stats/recent-activity-panel";
import { Button } from "@/components/ui/button";
import type { CallQueueStats, RecentCallActivity } from "@/types/domain";

export function TelepastorDashboard({
  stats,
  telepastorName,
  recentActivity = [],
}: {
  stats: CallQueueStats;
  telepastorName: string;
  recentActivity?: RecentCallActivity[];
}) {
  const ctaLabel = stats.remaining > 0 ? "Continue Calling" : "Start Calling";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Welcome back, {telepastorName.split(" ")[0]}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your calling queue is ready. Work through assigned contacts one at a
          time from your phone.
        </p>
      </div>

      <CallStatsGrid stats={stats} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          className="min-h-14 w-full text-base"
          size="lg"
          render={<Link href="/my-calls/queue" />}
        >
          <PhoneCall />
          {ctaLabel}
        </Button>
        <Button
          variant="outline"
          className="min-h-14 w-full text-base"
          size="lg"
          render={<Link href="/my-calls/list" />}
        >
          <List />
          View Contact List
        </Button>
      </div>

      <RecentActivityPanel
        activity={recentActivity}
        title="Recent call history"
      />
    </div>
  );
}
