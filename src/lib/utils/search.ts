export function escapeIlikePattern(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function buildContactSearchFilter(search: string) {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const escaped = escapeIlikePattern(trimmed);
  return `name.ilike.%${escaped}%,phone.ilike.%${escaped}%`;
}
