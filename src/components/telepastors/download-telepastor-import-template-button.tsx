"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadTelepastorImportTemplateAction } from "@/app/actions/telepastor-import";
import { Button } from "@/components/ui/button";

type DownloadTelepastorImportTemplateButtonProps = {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function DownloadTelepastorImportTemplateButton({
  variant = "outline",
  size = "default",
  className,
}: DownloadTelepastorImportTemplateButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const result = await downloadTelepastorImportTemplateAction();

      if (!result.success || !result.data) {
        toast.error(result.success ? "Unable to download template." : result.error);
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
      toast.success("Template downloaded.");
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={handleDownload}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Download />}
      Download template
    </Button>
  );
}
