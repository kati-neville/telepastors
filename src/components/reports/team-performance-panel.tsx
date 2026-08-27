import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRoleLabel } from "@/lib/auth/roles";
import type { TeamMemberStatistics } from "@/types/domain";

export function TeamPerformancePanel({
  rows,
  title,
}: {
  rows: TeamMemberStatistics[];
  title: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        No performance data for the current filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div key={row.memberId} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.memberName}</p>
                <Badge variant="secondary" className="mt-1">
                  {getRoleLabel(row.memberRole)}
                </Badge>
              </div>
              <p className="text-sm font-medium">{row.stats.completionPercentage}%</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Assigned" value={row.stats.totalContacts} />
              <Metric label="Completed" value={row.stats.completed} />
              <Metric label="Remaining" value={row.stats.remaining} />
              <Metric label="Coming" value={row.stats.coming} />
              <Metric label="Attempts" value={row.totalCallAttempts} />
              <Metric label="Reach" value={`${row.stats.reachRate}%`} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden rounded-xl border md:block">
        <div className="border-b px-4 py-3">
          <h3 className="font-heading text-base font-semibold">{title}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Coming</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.memberId}>
                <TableCell className="font-medium">{row.memberName}</TableCell>
                <TableCell>{getRoleLabel(row.memberRole)}</TableCell>
                <TableCell>{row.stats.totalContacts}</TableCell>
                <TableCell>{row.stats.completed}</TableCell>
                <TableCell>{row.stats.remaining}</TableCell>
                <TableCell>{row.stats.coming}</TableCell>
                <TableCell>{row.totalCallAttempts}</TableCell>
                <TableCell>{row.stats.completionPercentage}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
