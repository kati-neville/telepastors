"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportCampaignContactsAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

type ExportCampaignContactsButtonProps = {
  campaignId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function ExportCampaignContactsButton({
  campaignId,
  variant = "outline",
  size = "default",
  className,
}: ExportCampaignContactsButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const result = await exportCampaignContactsAction(campaignId);

      if (!result.success) {
        toast.error(result.error ?? "Unable to export contacts.");
        return;
      }

      if (!result.data) {
        toast.error("Unable to export contacts.");
        return;
      }

      const bytes = Uint8Array.from(atob(result.data.base64), (char) =>
        char.charCodeAt(0),
      );
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${result.data.rowCount} contact${
          result.data.rowCount === 1 ? "" : "s"
        }.`,
      );
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={handleExport}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Download />}
      {isPending ? "Exporting..." : "Export contacts"}
    </Button>
  );
}
