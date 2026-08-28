"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
};

export function TeamViewModeSwitcher({
  role,
  currentView,
}: TeamViewModeSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const views = getAvailableTeamPerformanceViews(role);

  if (views.length <= 1) {
    return null;
  }

  const setView = (view: TeamPerformanceView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);

    if (view === "governor") {
      params.delete("governorId");
      params.delete("leaderId");
      params.delete("telepastorId");
    } else if (view === "leader") {
      params.delete("leaderId");
      params.delete("telepastorId");
    } else {
      params.delete("telepastorId");
    }

    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          onClick={() => setView(view)}
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
