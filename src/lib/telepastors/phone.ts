import { normalizePhone } from "@/lib/phone/normalize";

export function getTelepastorPhoneNormalized(phone: string): string {
  const result = normalizePhone(phone);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.normalized;
}

export function tryGetTelepastorPhoneNormalized(
  phone: string,
): string | null {
  const result = normalizePhone(phone);
  return result.ok ? result.normalized : null;
}
