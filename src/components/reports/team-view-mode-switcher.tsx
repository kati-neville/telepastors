"use client";

import { cn } from "@/lib/utils";
import {
  getAvailableTeamPerformanceViews,
  TEAM_PERFORMANCE_VIEW_LABELS,
} from "@/lib/reports/team-performance-view";
import type { MinistryRole } from "@/types/domain";
import type { TeamPerformanceView } from "@/lib/validations/reports";

type TeamViewModeSwitcherProps = {
  role: MinistryRole;
  currentView: TeamPerformanceView;
  onViewChange: (view: TeamPerformanceView) => void;
};

export function TeamViewModeSwitcher({
  role,
  currentView,
  onViewChange,
}: TeamViewModeSwitcherProps) {
  const views = getAvailableTeamPerformanceViews(role);

  if (views.length <= 1) {
    return null;
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          onClick={() => onViewChange(view)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            currentView === view
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {TEAM_PERFORMANCE_VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}
