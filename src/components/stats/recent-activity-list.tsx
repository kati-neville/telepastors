import { CallResponseBadge } from "@/components/calls/call-response-badge";
import type { RecentCallActivity } from "@/types/domain";
import { truncateText } from "@/lib/utils/text";
import { MessageSquareText } from "lucide-react";

export function RecentActivityList({
  activity,
}: {
  activity: RecentCallActivity[];
}) {
  if (activity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent call activity.</p>
    );
  }

  return (
    <ul className="divide-y">
      {activity.map(item => {
        const hasNotes = Boolean(item.notes?.trim());

        return (
          <li
            key={item.id}
            className={`flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between ${
              hasNotes
                ? "rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 dark:border-amber-900/40 dark:bg-amber-950/20"
                : ""
            }`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.contactName}</p>
              <p className="text-xs text-muted-foreground">
                {item.telepastorName} · {item.campaignName}
              </p>
              {hasNotes ? (
                <div className="mt-2 rounded-lg border border-amber-300/70 bg-amber-100/80 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-950/50">
                  <p className="flex items-start gap-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{truncateText(item.notes!, 140)}</span>
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <CallResponseBadge response={item.response} />
              <time className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.attemptedAt))}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
