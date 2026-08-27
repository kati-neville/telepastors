import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { CallAttempt } from "@/types/domain";

export function CallHistoryPanel({ attempts }: { attempts: CallAttempt[] }) {
  if (attempts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium">Previous attempts</p>
      <ul className="mt-3 space-y-2">
        {attempts.map((attempt, index) => (
          <li
            key={attempt.id}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div>
              <p className="font-medium">
                Attempt {attempts.length - index}
              </p>
              <p className="text-muted-foreground">
                {CALL_RESPONSE_LABELS[attempt.response]}
              </p>
              {attempt.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {attempt.notes}
                </p>
              ) : null}
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(attempt.attempted_at))}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
