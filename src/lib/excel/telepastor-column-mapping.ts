import { TELEPASTOR_IMPORT_TEMPLATE_COLUMNS } from "@/lib/excel/telepastor-import-template";

export type TelepastorImportColumnMapping = {
  nameColumn: string;
  phoneColumn: string;
  addressColumn: string;
  roleColumn: string;
  leaderPhoneColumn: string;
  governorPhoneColumn: string;
};

export type TelepastorImportColumnSuggestion = TelepastorImportColumnMapping & {
  confidence: "high" | "ambiguous" | "none";
  requiresManualMapping: boolean;
};

function pickHeader(
  headers: string[],
  patterns: RegExp[],
  preferredExact?: string,
): string | null {
  if (preferredExact && headers.includes(preferredExact)) {
    return preferredExact;
  }

  const matches = headers.filter((header) =>
    patterns.some((pattern) => pattern.test(header.trim())),
  );

  return matches.length === 1 ? matches[0]! : matches[0] ?? null;
}

export function suggestTelepastorImportColumnMapping(
  headers: string[],
): TelepastorImportColumnSuggestion {
  const trimmed = headers.map((header) => header.trim()).filter(Boolean);
  const columns = TELEPASTOR_IMPORT_TEMPLATE_COLUMNS;

  const nameColumn = pickHeader(trimmed, [/^name$/i, /^full[\s_-]?name$/i], columns.name);
  const phoneColumn = pickHeader(
    trimmed,
    [/^phone$/i, /^phone[\s_-]?number$/i, /^mobile$/i],
    columns.phone,
  );
  const addressColumn = pickHeader(
    trimmed,
    [/^address$/i, /^location$/i, /^home[\s_-]?address$/i],
    columns.address,
  );
  const roleColumn = pickHeader(
    trimmed,
    [/^role$/i, /^ministry[\s_-]?role$/i],
    columns.role,
  );
  const leaderPhoneColumn = pickHeader(
    trimmed,
    [/^leader[\s_-]?phone$/i, /^leader[\s_-]?number$/i],
    columns.leaderPhone,
  );
  const governorPhoneColumn = pickHeader(
    trimmed,
    [/^governor[\s_-]?phone$/i, /^governor[\s_-]?number$/i],
    columns.governorPhone,
  );

  const mapping = {
    nameColumn: nameColumn ?? "",
    phoneColumn: phoneColumn ?? "",
    addressColumn: addressColumn ?? "",
    roleColumn: roleColumn ?? "",
    leaderPhoneColumn: leaderPhoneColumn ?? "",
    governorPhoneColumn: governorPhoneColumn ?? "",
  };

  const requiredReady =
    Boolean(mapping.nameColumn) &&
    Boolean(mapping.phoneColumn) &&
    Boolean(mapping.addressColumn) &&
    Boolean(mapping.roleColumn) &&
    Boolean(mapping.leaderPhoneColumn) &&
    Boolean(mapping.governorPhoneColumn);

  const templateExact =
    mapping.nameColumn === columns.name &&
    mapping.phoneColumn === columns.phone &&
    mapping.addressColumn === columns.address &&
    mapping.roleColumn === columns.role &&
    mapping.leaderPhoneColumn === columns.leaderPhone &&
    mapping.governorPhoneColumn === columns.governorPhone;

  return {
    ...mapping,
    confidence: templateExact ? "high" : requiredReady ? "ambiguous" : "none",
    requiresManualMapping: !requiredReady || !templateExact,
  };
}

export function validateTelepastorImportColumnMapping(
  headers: string[],
  mapping: TelepastorImportColumnMapping,
): string | null {
  const values = Object.values(mapping);
  for (const value of values) {
    if (!value || !headers.includes(value)) {
      return "One or more selected columns were not found in the file.";
    }
  }

  const unique = new Set(values);
  if (unique.size !== values.length) {
    return "Each field must map to a different column.";
  }

  return null;
}
