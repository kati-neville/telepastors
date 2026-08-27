import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/auth/roles";
import type { MinistryRole } from "@/types/domain";

export function RoleBadge({ role }: { role: MinistryRole }) {
  return <Badge variant="secondary">{getRoleLabel(role)}</Badge>;
}

export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "default" : "outline"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
