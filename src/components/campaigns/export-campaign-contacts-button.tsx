"use client";

import { useTransition } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportCampaignContactsAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CampaignContactExportKind } from "@/lib/excel/contact-export";

type ExportCampaignContactsButtonProps = {
  campaignId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
};

const EXPORT_OPTIONS: Array<{
  kind: CampaignContactExportKind;
  label: string;
  description: string;
}> = [
  {
    kind: "unattempted",
    label: "Unattempted calls",
    description: "Contacts with no call attempt",
  },
  {
    kind: "attempted",
    label: "Attempted calls",
    description: "Contacts with at least one attempt",
  },
  {
    kind: "all",
    label: "All contacts",
    description: "Every contact in this campaign",
  },
];

export function ExportCampaignContactsButton({
  campaignId,
  variant = "outline",
  size = "default",
  className,
}: ExportCampaignContactsButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleExport = (kind: CampaignContactExportKind) => {
    startTransition(async () => {
      const result = await exportCampaignContactsAction(campaignId, kind);

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

      const noun =
        kind === "attempted"
          ? "attempted contact"
          : kind === "unattempted"
            ? "unattempted contact"
            : "contact";
      toast.success(
        `Exported ${result.data.rowCount} ${noun}${
          result.data.rowCount === 1 ? "" : "s"
        }.`,
      );
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={isPending}
          />
        }
      >
        {isPending ? <Loader2 className="animate-spin" /> : <Download />}
        {isPending ? "Exporting..." : "Export"}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        {EXPORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.kind}
            disabled={isPending}
            onClick={() => handleExport(option.kind)}
          >
            <div className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
