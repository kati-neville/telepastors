const INTERNAL_PATTERNS = [
  /row-level security/i,
  /permission denied/i,
  /violates .* constraint/i,
  /duplicate key/i,
  /invalid input syntax/i,
  /jwt/i,
  /pgrst/i,
  /postgres/i,
  /sql/i,
  /relation .* does not exist/i,
];

export function toClientErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : null;

  if (!message?.trim()) {
    return fallback;
  }

  const trimmed = message.trim();

  if (/duplicate key|unique constraint|telepastors_phone_normalized/i.test(trimmed)) {
    return "That phone number is already registered to another ministry member.";
  }

  if (
    /row-level security/i.test(trimmed) ||
    /PGRST116/i.test(trimmed) ||
    /PGRST301/i.test(trimmed) ||
    /42501/.test(trimmed) ||
    /JSON object requested, multiple \(or no\) rows returned/i.test(trimmed)
  ) {
    return "You do not have permission to create this member with the selected role or placement.";
  }

  if (/enforce_telepastor_hierarchy|Telepastors must be assigned|must belong to the same Governor/i.test(trimmed)) {
    return trimmed;
  }

  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  return trimmed;
}

export function toActionErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return toClientErrorMessage(error, fallback);
}
