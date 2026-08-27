import * as XLSX from "xlsx";
import { normalizePhone } from "@/lib/phone/normalize";
import type { ColumnMapping } from "@/lib/excel/column-mapping";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: Record<string, string>[];
  sheetName: string;
};

export function parseSpreadsheetBuffer(buffer: ArrayBuffer): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { headers: [], rows: [], sheetName: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], rows: [], sheetName };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  const headers = Object.keys(rawRows[0] ?? {}).map((header) => header.trim());
  const rows = rawRows.map((row) => {
    const normalizedRow: Record<string, string> = {};

    for (const header of headers) {
      const value = row[header];
      normalizedRow[header] =
        value === null || value === undefined ? "" : String(value).trim();
    }

    return normalizedRow;
  });

  return { headers, rows, sheetName };
}

export type ImportRowStatus = "valid" | "invalid" | "duplicate";

export type ValidatedImportRow = {
  rowNumber: number;
  name: string;
  phone: string;
  phoneNormalized: string | null;
  status: ImportRowStatus;
  errors: string[];
  duplicateReason: "file" | "campaign" | null;
};

export type ImportValidationSummary = {
  totalRows: number;
  validRows: ValidatedImportRow[];
  invalidRows: ValidatedImportRow[];
  duplicateRows: ValidatedImportRow[];
  missingNameRows: number;
  missingPhoneRows: number;
  rows: ValidatedImportRow[];
};

export function validateImportRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingNormalizedPhones: Set<string>,
): ImportValidationSummary {
  const seenInFile = new Set<string>();
  const validated: ValidatedImportRow[] = [];

  let missingNameRows = 0;
  let missingPhoneRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = row[mapping.nameColumn]?.trim() ?? "";
    const phone = row[mapping.phoneColumn]?.trim() ?? "";
    const errors: string[] = [];

    if (!name) {
      missingNameRows += 1;
      errors.push("Missing name");
    }

    if (!phone) {
      missingPhoneRows += 1;
      errors.push("Missing phone number");
    }

    let phoneNormalized: string | null = null;

    if (phone) {
      const normalized = normalizePhone(phone);
      if (!normalized.ok) {
        errors.push(normalized.error);
      } else {
        phoneNormalized = normalized.normalized;
      }
    }

    let status: ImportRowStatus = "valid";
    let duplicateReason: "file" | "campaign" | null = null;

    if (errors.length > 0) {
      status = "invalid";
    } else if (phoneNormalized) {
      if (seenInFile.has(phoneNormalized)) {
        status = "duplicate";
        duplicateReason = "file";
        errors.push("Duplicate phone number within this file");
      } else if (existingNormalizedPhones.has(phoneNormalized)) {
        status = "duplicate";
        duplicateReason = "campaign";
        errors.push("Phone number already exists in this campaign");
      } else {
        seenInFile.add(phoneNormalized);
      }
    }

    validated.push({
      rowNumber,
      name,
      phone,
      phoneNormalized,
      status,
      errors,
      duplicateReason,
    });
  });

  const validRows = validated.filter((row) => row.status === "valid");
  const invalidRows = validated.filter((row) => row.status === "invalid");
  const duplicateRows = validated.filter((row) => row.status === "duplicate");

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    missingNameRows,
    missingPhoneRows,
    rows: validated,
  };
}

export const IMPORT_BATCH_SIZE = 500;
