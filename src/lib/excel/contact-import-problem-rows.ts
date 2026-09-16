import * as XLSX from "xlsx";
import type { ValidatedImportRow } from "@/lib/excel/parse-contacts";

export function buildContactImportProblemRowsFilename(importId: string) {
  return `contact-import-problems-${importId.slice(0, 8)}.xlsx`;
}

export function buildContactImportProblemRowsBuffer(
  rows: ValidatedImportRow[],
): ArrayBuffer {
  const sheetRows = rows.map((row) => ({
    Row: row.rowNumber,
    Name: row.name,
    Phone: row.phone,
    Status: row.status,
    Issue: row.errors.join("; "),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 48 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Problem rows");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
