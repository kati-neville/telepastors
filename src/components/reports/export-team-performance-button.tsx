"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportTeamPerformanceCsv } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import type { ReportFilterValues } from "@/lib/validations/reports";

export function ExportTeamPerformanceButton({
  filters,
}: {
  filters: ReportFilterValues;
}) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      try {
        const csv = await exportTeamPerformanceCsv(filters);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "team-performance.csv";
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Report exported.");
      } catch {
        toast.error("Failed to export report.");
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={handleExport}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Download />}
      Export CSV
    </Button>
  );
}
