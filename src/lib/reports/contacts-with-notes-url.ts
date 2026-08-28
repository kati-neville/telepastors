import type { ReportFilterValues } from "@/lib/validations/reports";

export function buildContactsWithNotesHref(
  filters: ReportFilterValues = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/contacts-with-notes?${query}` : "/contacts-with-notes";
}
