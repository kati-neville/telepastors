import { Badge } from "@/components/ui/badge";
import type { SmsBroadcastStatus } from "@/types/domain";

const STATUS_LABELS: Record<SmsBroadcastStatus, string> = {
  PENDING: "Pending",
  SENDING: "Sending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  UNAVAILABLE: "Unavailable",
};

const STATUS_VARIANT: Record<
  SmsBroadcastStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "outline",
  SENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
  UNAVAILABLE: "outline",
};

export function BroadcastStatusBadge({ status }: { status: SmsBroadcastStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
