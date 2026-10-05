"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadLeadershipDashboardAction } from "@/app/actions/reports";
import { LeadershipDashboard } from "@/components/dashboard/leadership-dashboard";
import { ExportTeamPerformanceButton } from "@/components/reports/export-team-performance-button";
import { ReportFilters } from "@/components/reports/report-filters";
import type { LeadershipDashboardData } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

type ReportsPageClientProps = {
  initialData: LeadershipDashboardData;
  role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER";
};

export function ReportsPageClient({
  initialData,
  role,
}: ReportsPageClientProps) {
  const [filters, setFilters] = useState<ReportFilterValues>({});
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const applyFilters = (next: ReportFilterValues) => {
    setFilters(next);
    startTransition(async () => {
      try {
        const nextData = await loadLeadershipDashboardAction(next);
        setData(nextData);
      } catch {
        toast.error("Failed to load report with those filters.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Campaign and team statistics for {data.scopeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportFilters
            filters={filters}
            options={data.filterOptions}
            role={role}
            onApply={applyFilters}
          />
          <ExportTeamPerformanceButton filters={filters} />
        </div>
      </div>

      <div className="relative">
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-24">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="size-4 animate-spin" />
              Updating report…
            </div>
          </div>
        ) : null}

        <div className={isPending ? "pointer-events-none opacity-60" : undefined}>
          <LeadershipDashboard
            data={data}
            role={role}
            filters={filters}
            showFullReportsLink={false}
            showHeader={false}
            variant="reports"
          />
        </div>
      </div>
    </div>
  );
}
