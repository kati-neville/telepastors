import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/types/domain";
import { getCampaignStatusLabel } from "@/lib/campaigns/format";

const STATUS_VARIANT: Record<
  CampaignStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  ACTIVE: "default",
  COMPLETED: "secondary",
  ARCHIVED: "outline",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{getCampaignStatusLabel(status)}</Badge>
  );
}
