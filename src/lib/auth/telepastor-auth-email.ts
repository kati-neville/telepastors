const AUTH_EMAIL_DOMAIN =
  process.env.TELEPASTOR_AUTH_EMAIL_DOMAIN ?? "accounts.telepastors.local";

export function buildTelepastorAuthEmail(telepastorId: string): string {
  const localPart = telepastorId.replace(/-/g, "");
  return `${localPart}@${AUTH_EMAIL_DOMAIN}`;
}

export function isSyntheticTelepastorAuthEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return email.toLowerCase().endsWith(`@${AUTH_EMAIL_DOMAIN.toLowerCase()}`);
}
