import type { ReportFilterValues } from "@/lib/validations/reports";

export function buildActivityHref(filters: ReportFilterValues = {}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/activity?${query}` : "/activity";
}
