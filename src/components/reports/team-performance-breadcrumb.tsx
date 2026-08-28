"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTeamPerformanceBreadcrumb } from "@/lib/reports/team-performance-view";
import type { MinistryRole } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

type TeamPerformanceBreadcrumbProps = {
  role: MinistryRole;
  filters: ReportFilterValues;
  basePath: string;
  memberNames: {
    governorName?: string | null;
    leaderName?: string | null;
  };
};

export function TeamPerformanceBreadcrumb({
  role,
  filters,
  basePath,
  memberNames,
}: TeamPerformanceBreadcrumbProps) {
  const crumbs = getTeamPerformanceBreadcrumb(
    role,
    filters,
    basePath,
    memberNames,
  );

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Team performance scope"
      className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5" /> : null}
          <Link href={crumb.href} className="font-medium hover:text-foreground">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
