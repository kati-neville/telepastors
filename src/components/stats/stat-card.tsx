export function StatCard({
  label,
  value,
  suffix,
  highlight = false,
  description,
  size = "default",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  highlight?: boolean;
  description?: string;
  size?: "default" | "lg";
}) {
  const isLarge = size === "lg";

  return (
    <div
      className={`rounded-xl border shadow-sm ${
        isLarge ? "p-5 sm:p-6" : "p-4"
      } ${highlight ? "border-primary/30 bg-primary/5" : "bg-card"}`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-heading font-semibold tabular-nums ${
          isLarge ? "text-3xl sm:text-4xl" : "text-2xl"
        }`}
      >
        {value}
        {suffix ? (
          <span
            className={`ml-1.5 font-normal text-muted-foreground ${
              isLarge ? "text-base sm:text-lg" : "text-base"
            }`}
          >
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
