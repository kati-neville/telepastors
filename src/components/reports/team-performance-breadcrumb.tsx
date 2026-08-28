"use client";

import { ChevronRight } from "lucide-react";
import type { TeamPerformanceCrumb, TeamPerformanceScope } from "@/lib/reports/team-performance-view";

type TeamPerformanceBreadcrumbProps = {
  items: TeamPerformanceCrumb[];
  onNavigate: (scope: TeamPerformanceScope) => void;
};

export function TeamPerformanceBreadcrumb({
  items,
  onNavigate,
}: TeamPerformanceBreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Team performance scope"
      className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      {items.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5" /> : null}
          <button
            type="button"
            onClick={() => onNavigate(crumb.scope)}
            className="font-medium hover:text-foreground"
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
