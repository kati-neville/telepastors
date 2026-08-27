import { CallResponseBadge } from "@/components/calls/call-response-badge";
import type { RecentCallActivity } from "@/types/domain";

export function RecentActivityPanel({
  activity,
  title = "Recent activity",
}: {
  activity: RecentCallActivity[];
  title?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      {activity.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No recent call activity.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {activity.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{item.contactName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.telepastorName} · {item.campaignName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CallResponseBadge response={item.response} />
                <time className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.attemptedAt))}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
