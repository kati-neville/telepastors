type SupabaseLikeError = {
  message?: string | null;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
};

/** Build a useful message when PostgREST HEAD counts return empty `message`. */
export function formatSupabaseError(
  error: SupabaseLikeError | null | undefined,
  fallback: string,
): string {
  if (!error) {
    return fallback;
  }

  const parts = [
    error.message?.trim(),
    error.code ? `code ${error.code}` : null,
    typeof error.status === "number" ? `status ${error.status}` : null,
    error.hint?.trim(),
    error.details?.trim(),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" — ") : fallback;
}
