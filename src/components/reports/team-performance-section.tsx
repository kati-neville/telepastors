import { TeamPerformanceSectionClient } from "@/components/reports/team-performance-section-client";
import type {
  MinistryRole,
  ReportFilterOptions,
  TeamPerformanceBundle,
} from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";

type TeamPerformanceSectionProps = {
  bundle: TeamPerformanceBundle;
  role: MinistryRole;
  filters: ReportFilterValues;
  filterOptions: ReportFilterOptions;
};

export function TeamPerformanceSection({
  bundle,
  role,
  filters,
  filterOptions,
}: TeamPerformanceSectionProps) {
  return (
    <TeamPerformanceSectionClient
      bundle={bundle}
      role={role}
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
