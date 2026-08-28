"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyTeamPerformanceViewChange,
  buildTeamMemberDrillDownScope,
  canDrillDownFromRow,
} from "@/lib/reports/team-performance-view";
import { getRoleLabel } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { MinistryRole, TeamMemberStatistics } from "@/types/domain";
import type { TeamPerformanceScope } from "@/lib/reports/team-performance-view";
import type { TeamPerformanceView } from "@/lib/validations/reports";

type SortKey =
  | "name"
  | "assigned"
  | "completed"
  | "remaining"
  | "coming"
  | "attempts"
  | "completion";

type TeamPerformancePanelProps = {
  rows: TeamMemberStatistics[];
  title: string;
  actorRole: MinistryRole;
  view: TeamPerformanceView;
  scope: TeamPerformanceScope;
  onDrillDown: (scope: TeamPerformanceScope) => void;
};

export function TeamPerformancePanel({
  rows,
  title,
  actorRole,
  view,
  scope,
  onDrillDown,
}: TeamPerformancePanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("completion");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortKey) {
        case "name":
          return a.memberName.localeCompare(b.memberName) * direction;
        case "assigned":
          return (a.stats.totalContacts - b.stats.totalContacts) * direction;
        case "completed":
          return (a.stats.completed - b.stats.completed) * direction;
        case "remaining":
          return (a.stats.remaining - b.stats.remaining) * direction;
        case "coming":
          return (a.stats.coming - b.stats.coming) * direction;
        case "attempts":
          return (a.totalCallAttempts - b.totalCallAttempts) * direction;
        case "completion":
        default:
          return (
            (a.stats.completionPercentage - b.stats.completionPercentage) *
            direction
          );
      }
    });

    return copy;
  }, [rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : "desc");
  };

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
        {sortedRows.map((row) => (
          <PerformanceCard
            key={row.memberId}
            row={row}
            actorRole={actorRole}
            view={view}
            scope={scope}
            onDrillDown={onDrillDown}
          />
        ))}
      </div>

      <div className="hidden rounded-xl border md:block">
        <div className="border-b px-4 py-3">
          <h3 className="font-heading text-base font-semibold">{title}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Name"
                active={sortKey === "name"}
                direction={sortDirection}
                onClick={() => toggleSort("name")}
              />
              <TableHead>Role</TableHead>
              <SortableHead
                label="Assigned"
                active={sortKey === "assigned"}
                direction={sortDirection}
                onClick={() => toggleSort("assigned")}
              />
              <SortableHead
                label="Completed"
                active={sortKey === "completed"}
                direction={sortDirection}
                onClick={() => toggleSort("completed")}
              />
              <SortableHead
                label="Remaining"
                active={sortKey === "remaining"}
                direction={sortDirection}
                onClick={() => toggleSort("remaining")}
              />
              <SortableHead
                label="Coming"
                active={sortKey === "coming"}
                direction={sortDirection}
                onClick={() => toggleSort("coming")}
              />
              <SortableHead
                label="Attempts"
                active={sortKey === "attempts"}
                direction={sortDirection}
                onClick={() => toggleSort("attempts")}
              />
              <SortableHead
                label="Completion"
                active={sortKey === "completion"}
                direction={sortDirection}
                onClick={() => toggleSort("completion")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <PerformanceRow
                key={row.memberId}
                row={row}
                actorRole={actorRole}
                view={view}
                scope={scope}
                onDrillDown={onDrillDown}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PerformanceRow({
  row,
  actorRole,
  view,
  scope,
  onDrillDown,
}: {
  row: TeamMemberStatistics;
  actorRole: MinistryRole;
  view: TeamPerformanceView;
  scope: TeamPerformanceScope;
  onDrillDown: (scope: TeamPerformanceScope) => void;
}) {
  const drillDownScope = buildTeamMemberDrillDownScope(
    actorRole,
    view,
    row,
    scope,
  );
  const isDrillDown = canDrillDownFromRow(actorRole, view, row);

  return (
    <TableRow className={isDrillDown ? "group" : undefined}>
      <TableCell className="font-medium">
        {drillDownScope ? (
          <button
            type="button"
            onClick={() => onDrillDown(drillDownScope)}
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            {row.memberName}
            <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          row.memberName
        )}
      </TableCell>
      <TableCell>{getRoleLabel(row.memberRole)}</TableCell>
      <TableCell>{row.stats.totalContacts}</TableCell>
      <TableCell>{row.stats.completed}</TableCell>
      <TableCell>{row.stats.remaining}</TableCell>
      <TableCell>{row.stats.coming}</TableCell>
      <TableCell>{row.totalCallAttempts}</TableCell>
      <TableCell>{row.stats.completionPercentage}%</TableCell>
    </TableRow>
  );
}

function PerformanceCard({
  row,
  actorRole,
  view,
  scope,
  onDrillDown,
}: {
  row: TeamMemberStatistics;
  actorRole: MinistryRole;
  view: TeamPerformanceView;
  scope: TeamPerformanceScope;
  onDrillDown: (scope: TeamPerformanceScope) => void;
}) {
  const drillDownScope = buildTeamMemberDrillDownScope(
    actorRole,
    view,
    row,
    scope,
  );

  const content = (
    <>
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
    </>
  );

  if (!drillDownScope) {
    return <div className="rounded-xl border bg-card p-4 shadow-sm">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onDrillDown(drillDownScope)}
      className="block w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      {content}
    </button>
  );
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (direction === "asc" ? " ↑" : " ↓") : null}
      </button>
    </TableHead>
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
