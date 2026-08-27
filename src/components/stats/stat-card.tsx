export function StatCard({
  label,
  value,
  suffix,
  highlight = false,
  description,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  highlight?: boolean;
  description?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        highlight ? "border-primary/30 bg-primary/5" : "bg-card"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold">
        {value}
        {suffix ? (
          <span className="ml-1 text-base font-normal text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </p>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
