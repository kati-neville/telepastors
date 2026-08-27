export type NormalizePhoneSuccess = {
  ok: true;
  normalized: string;
  original: string;
};

export type NormalizePhoneFailure = {
  ok: false;
  original: string;
  error: string;
};

export type NormalizePhoneResult = NormalizePhoneSuccess | NormalizePhoneFailure;

export function normalizePhone(raw: string): NormalizePhoneResult {
  const original = raw.trim();

  if (!original) {
    return { ok: false, original: raw, error: "Missing phone number" };
  }

  let cleaned = original.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);

    if (!/^\d{8,15}$/.test(digits)) {
      return {
        ok: false,
        original,
        error: "Invalid international phone number length",
      };
    }

    return { ok: true, normalized: cleaned, original };
  }

  if (cleaned.startsWith("233")) {
    if (!/^233\d{9}$/.test(cleaned)) {
      return { ok: false, original, error: "Invalid Ghana phone number" };
    }

    return { ok: true, normalized: `+${cleaned}`, original };
  }

  if (cleaned.startsWith("0")) {
    if (!/^0\d{9}$/.test(cleaned)) {
      return {
        ok: false,
        original,
        error: "Invalid local phone number (expected 10 digits)",
      };
    }

    return { ok: true, normalized: `+233${cleaned.slice(1)}`, original };
  }

  if (/^\d{9}$/.test(cleaned)) {
    return { ok: true, normalized: `+233${cleaned}`, original };
  }

  return {
    ok: false,
    original,
    error: "Unrecognized phone number format",
  };
}

export function formatPhoneDisplay(normalized: string) {
  return normalized;
}
