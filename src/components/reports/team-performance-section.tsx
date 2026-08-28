import {
  getTeamPerformanceTitle,
} from "@/lib/reports/team-performance-view";
import { TeamPerformanceBreadcrumb } from "@/components/reports/team-performance-breadcrumb";
import { TeamPerformancePanel } from "@/components/reports/team-performance-panel";
import { TeamViewModeSwitcher } from "@/components/reports/team-view-mode-switcher";
import type {
  MinistryRole,
  ReportFilterOptions,
  TeamMemberStatistics,
} from "@/types/domain";
import type { ReportFilterValues, TeamPerformanceView } from "@/lib/validations/reports";

type TeamPerformanceSectionProps = {
  rows: TeamMemberStatistics[];
  view: TeamPerformanceView;
  role: MinistryRole;
  filters: ReportFilterValues;
  basePath: string;
  filterOptions: ReportFilterOptions;
};

export function TeamPerformanceSection({
  rows,
  view,
  role,
  filters,
  basePath,
  filterOptions,
}: TeamPerformanceSectionProps) {
  const governorName = filters.governorId
    ? filterOptions.governors.find((member) => member.id === filters.governorId)
        ?.name
    : null;
  const leaderName = filters.leaderId
    ? filterOptions.leaders.find((member) => member.id === filters.leaderId)?.name
    : null;

  const title = getTeamPerformanceTitle(role, view);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TeamViewModeSwitcher role={role} currentView={view} />
        <TeamPerformanceBreadcrumb
          role={role}
          filters={filters}
          basePath={basePath}
          memberNames={{ governorName, leaderName }}
        />
      </div>

      <TeamPerformancePanel
        rows={rows}
        title={title}
        actorRole={role}
        view={view}
        filters={filters}
        basePath={basePath}
      />
    </div>
  );
}
