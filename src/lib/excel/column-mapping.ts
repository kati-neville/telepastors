const NAME_HEADER_PATTERNS = [
  /^name$/i,
  /^full[\s_-]?name$/i,
  /^contact[\s_-]?name$/i,
  /^member[\s_-]?name$/i,
  /^first[\s_-]?name$/i,
];

const PHONE_HEADER_PATTERNS = [
  /^phone$/i,
  /^phone[\s_-]?number$/i,
  /^mobile$/i,
  /^mobile[\s_-]?number$/i,
  /^tel(?:ephone)?$/i,
  /^contact[\s_-]?number$/i,
  /^number$/i,
];

const EXCLUDED_NAME_PATTERNS = [/phone/i, /mobile/i, /number/i, /tel/i];

export type ColumnMappingSuggestion = {
  nameColumn: string | null;
  phoneColumn: string | null;
  nameCandidates: string[];
  phoneCandidates: string[];
  confidence: "high" | "ambiguous" | "none";
  requiresManualMapping: boolean;
};

function scoreNameHeader(header: string) {
  if (EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(header))) {
    return 0;
  }

  return NAME_HEADER_PATTERNS.some((pattern) => pattern.test(header.trim()))
    ? 2
    : /name/i.test(header)
      ? 1
      : 0;
}

function scorePhoneHeader(header: string) {
  return PHONE_HEADER_PATTERNS.some((pattern) => pattern.test(header.trim()))
    ? 2
    : /phone|mobile|tel|number/i.test(header)
      ? 1
      : 0;
}

export function suggestColumnMapping(headers: string[]): ColumnMappingSuggestion {
  const trimmedHeaders = headers.map((header) => header.trim()).filter(Boolean);

  const nameCandidates = trimmedHeaders
    .filter((header) => scoreNameHeader(header) > 0)
    .sort((a, b) => scoreNameHeader(b) - scoreNameHeader(a));

  const phoneCandidates = trimmedHeaders
    .filter((header) => scorePhoneHeader(header) > 0)
    .sort((a, b) => scorePhoneHeader(b) - scorePhoneHeader(a));

  const topNameScore =
    nameCandidates[0] ? scoreNameHeader(nameCandidates[0]) : 0;
  const topPhoneScore =
    phoneCandidates[0] ? scorePhoneHeader(phoneCandidates[0]) : 0;

  const nameColumn =
    nameCandidates.length === 1 && topNameScore >= 2
      ? nameCandidates[0]!
      : nameCandidates.length === 1 && topNameScore === 1
        ? nameCandidates[0]!
        : null;

  const phoneColumn =
    phoneCandidates.length === 1 && topPhoneScore >= 2
      ? phoneCandidates[0]!
      : phoneCandidates.length === 1 && topPhoneScore === 1
        ? phoneCandidates[0]!
        : null;

  const confidence =
    nameColumn && phoneColumn && topNameScore >= 2 && topPhoneScore >= 2
      ? "high"
      : nameCandidates.length > 0 && phoneCandidates.length > 0
        ? "ambiguous"
        : "none";

  return {
    nameColumn,
    phoneColumn,
    nameCandidates,
    phoneCandidates,
    confidence,
    requiresManualMapping: !nameColumn || !phoneColumn || confidence !== "high",
  };
}

export type ColumnMapping = {
  nameColumn: string;
  phoneColumn: string;
};

export function validateColumnMapping(
  headers: string[],
  mapping: ColumnMapping,
): string | null {
  if (!headers.includes(mapping.nameColumn)) {
    return "Selected name column was not found in the file.";
  }

  if (!headers.includes(mapping.phoneColumn)) {
    return "Selected phone column was not found in the file.";
  }

  if (mapping.nameColumn === mapping.phoneColumn) {
    return "Name and phone must map to different columns.";
  }

  return null;
}
