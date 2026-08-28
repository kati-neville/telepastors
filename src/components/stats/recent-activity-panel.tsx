import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RecentActivityList } from "@/components/stats/recent-activity-list";
import { RECENT_ACTIVITY_PREVIEW_LIMIT } from "@/lib/reports/recent-activity-limit";
import type { RecentCallActivity } from "@/types/domain";

export function RecentActivityPanel({
  activity,
  title = "Recent activity",
  viewAllHref,
  previewLimit = RECENT_ACTIVITY_PREVIEW_LIMIT,
}: {
  activity: RecentCallActivity[];
  title?: string;
  viewAllHref?: string;
  previewLimit?: number;
}) {
  const preview = activity.slice(0, previewLimit);
  const hasMore = activity.length > previewLimit;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        {viewAllHref && activity.length > 0 ? (
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3">
        <RecentActivityList activity={preview} />
      </div>

      {viewAllHref && hasMore ? (
        <div className="mt-3 border-t pt-3">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all {activity.length} activities
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
