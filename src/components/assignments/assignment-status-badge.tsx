import { Badge } from "@/components/ui/badge";
import type { ContactAssignmentStatus } from "@/types/domain";

const STATUS_LABELS: Record<ContactAssignmentStatus, string> = {
  UNASSIGNED: "Unassigned",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

const STATUS_VARIANT: Record<
  ContactAssignmentStatus,
  "default" | "secondary" | "outline"
> = {
  UNASSIGNED: "outline",
  ASSIGNED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "secondary",
};

export function AssignmentStatusBadge({
  status,
}: {
  status: ContactAssignmentStatus;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
