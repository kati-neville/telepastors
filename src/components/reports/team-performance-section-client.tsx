"use client";

import { useMemo, useState } from "react";
import {
  applyTeamPerformanceViewChange,
  createInitialTeamPerformanceScope,
  getTeamPerformanceBreadcrumbItems,
  getTeamPerformanceTitle,
  selectTeamPerformanceRows,
  type TeamPerformanceScope,
} from "@/lib/reports/team-performance-view";
import { TeamPerformanceBreadcrumb } from "@/components/reports/team-performance-breadcrumb";
import { TeamPerformancePanel } from "@/components/reports/team-performance-panel";
import { TeamViewModeSwitcher } from "@/components/reports/team-view-mode-switcher";
import type {
  MinistryRole,
  ReportFilterOptions,
  TeamPerformanceBundle,
} from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

type TeamPerformanceSectionClientProps = {
  bundle: TeamPerformanceBundle;
  role: MinistryRole;
  filters: ReportFilterValues;
  filterOptions: ReportFilterOptions;
};

export function TeamPerformanceSectionClient({
  bundle,
  role,
  filters,
  filterOptions,
}: TeamPerformanceSectionClientProps) {
  const [scope, setScope] = useState<TeamPerformanceScope>(() =>
    createInitialTeamPerformanceScope(role, filters),
  );

  const rows = useMemo(
    () => selectTeamPerformanceRows(bundle, role, scope),
    [bundle, role, scope],
  );

  const governorName = scope.governorId
    ? filterOptions.governors.find((member) => member.id === scope.governorId)
        ?.name
    : null;
  const leaderName = scope.leaderId
    ? filterOptions.leaders.find((member) => member.id === scope.leaderId)?.name
    : null;

  const title = getTeamPerformanceTitle(role, scope.view);
  const breadcrumbItems = getTeamPerformanceBreadcrumbItems(role, scope, {
    governorName,
    leaderName,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TeamViewModeSwitcher
          role={role}
          currentView={scope.view}
          onViewChange={(view) =>
            setScope((current) => applyTeamPerformanceViewChange(current, view))
          }
        />
        <TeamPerformanceBreadcrumb
          items={breadcrumbItems}
          onNavigate={setScope}
        />
      </div>

      <TeamPerformancePanel
        rows={rows}
        title={title}
        actorRole={role}
        view={scope.view}
        scope={scope}
        onDrillDown={setScope}
      />
    </div>
  );
}
