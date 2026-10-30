/**
 * Convert report date-picker values (YYYY-MM-DD) into timestamptz bounds.
 * `from` is start of that local calendar day; `to` is end of that day
 * so a single-day filter includes the whole day.
 */
export function toReportFromBound(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return value.trim();
  }

  return `${day}T00:00:00.000`;
}

export function toReportToBound(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return value.trim();
  }

  return `${day}T23:59:59.999`;
}
