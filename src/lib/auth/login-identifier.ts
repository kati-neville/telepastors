import { normalizePhone } from "@/lib/phone/normalize";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedLoginIdentifier =
  | { type: "email"; email: string }
  | { type: "phone"; phone: string }
  | { type: "invalid"; message: string };

export function parseLoginIdentifier(raw: string): ParsedLoginIdentifier {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { type: "invalid", message: "Enter your email or phone number." };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return { type: "email", email: trimmed.toLowerCase() };
  }

  const normalized = normalizePhone(trimmed);

  if (!normalized.ok) {
    return {
      type: "invalid",
      message: "Enter a valid email address or phone number.",
    };
  }

  return { type: "phone", phone: normalized.normalized };
}
