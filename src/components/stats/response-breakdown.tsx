import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { CampaignStatistics } from "@/types/domain";

const RESPONSE_ITEMS: {
  key: keyof Pick<
    CampaignStatistics,
    "coming" | "notComing" | "unreachable" | "wrongNumber" | "other"
  >;
  label: keyof typeof CALL_RESPONSE_LABELS;
}[] = [
  { key: "coming", label: "COMING" },
  { key: "notComing", label: "NOT_COMING" },
  { key: "unreachable", label: "UNREACHABLE" },
  { key: "wrongNumber", label: "WRONG_NUMBER" },
  { key: "other", label: "OTHER" },
];

export function ResponseBreakdown({ stats }: { stats: CampaignStatistics }) {
  const maxValue = Math.max(
    stats.coming,
    stats.notComing,
    stats.unreachable,
    stats.wrongNumber,
    stats.other,
    1,
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="font-heading text-base font-semibold">Response breakdown</h3>
        <p className="text-sm text-muted-foreground">
          Unique contacts by latest response — not call attempts.
        </p>
      </div>

      <div className="space-y-3">
        {RESPONSE_ITEMS.map(({ key, label }) => {
          const value = stats[key];
          const width = Math.round((value / maxValue) * 100);

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{CALL_RESPONSE_LABELS[label]}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
