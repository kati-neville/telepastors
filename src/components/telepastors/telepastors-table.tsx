import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TelepastorAvatar } from "@/components/telepastors/telepastor-avatar";
import {
  ActiveStatusBadge,
  RoleBadge,
} from "@/components/telepastors/telepastor-status-badge";
import type { TelepastorDirectoryEntry } from "@/types/domain";

export function TelepastorsTable({
  telepastors,
}: {
  telepastors: TelepastorDirectoryEntry[];
}) {
  return (
    <div className="hidden rounded-xl border bg-card shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Leader</TableHead>
            <TableHead>Governor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {telepastors.map((telepastor) => (
            <TableRow key={telepastor.id}>
              <TableCell>
                <Link
                  href={`/telepastors/${telepastor.id}`}
                  className="flex items-center gap-3 font-medium hover:underline"
                >
                  <TelepastorAvatar
                    name={telepastor.name}
                    photoUrl={telepastor.profile_picture_url}
                    size="sm"
                  />
                  {telepastor.name}
                </Link>
              </TableCell>
              <TableCell>{telepastor.phone}</TableCell>
              <TableCell className="max-w-xs truncate">
                {telepastor.address ?? "—"}
              </TableCell>
              <TableCell>
                <RoleBadge role={telepastor.role} />
              </TableCell>
              <TableCell>{telepastor.leader_name ?? "—"}</TableCell>
              <TableCell>{telepastor.governor_name ?? "—"}</TableCell>
              <TableCell>
                <ActiveStatusBadge isActive={telepastor.is_active} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
