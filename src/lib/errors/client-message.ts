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

  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message.trim();
}

export function toActionErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return toClientErrorMessage(error, fallback);
}
