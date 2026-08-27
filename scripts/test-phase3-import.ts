import { suggestColumnMapping } from "@/lib/excel/column-mapping";
import {
  buildContactImportTemplateBuffer,
  CONTACT_IMPORT_TEMPLATE_COLUMNS,
  CONTACT_IMPORT_TEMPLATE_FILENAME,
} from "@/lib/excel/contact-import-template";
import { parseSpreadsheetBuffer, validateImportRows } from "@/lib/excel/parse-contacts";
import { normalizePhone } from "@/lib/phone/normalize";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testPhoneNormalization() {
  const ghanaLocal = normalizePhone("0244123456");
  assert(ghanaLocal.ok && ghanaLocal.normalized === "+233244123456", "Ghana local");

  const ghanaIntl = normalizePhone("+233244123456");
  assert(ghanaIntl.ok && ghanaIntl.normalized === "+233244123456", "Ghana intl");

  const ghanaNoPlus = normalizePhone("233244123456");
  assert(ghanaNoPlus.ok && ghanaNoPlus.normalized === "+233244123456", "Ghana 233");

  const international = normalizePhone("+14155552671");
  assert(
    international.ok && international.normalized === "+14155552671",
    "International",
  );

  const missing = normalizePhone("");
  assert(!missing.ok, "Missing phone");

  const originalPreserved = normalizePhone("0244 123 456");
  assert(originalPreserved.ok && originalPreserved.original === "0244 123 456", "Original preserved");
}

function testColumnMapping() {
  const suggestion = suggestColumnMapping(["Name", "Phone Number"]);
  assert(suggestion.nameColumn === "Name", "Name column detected");
  assert(suggestion.phoneColumn === "Phone Number", "Phone column detected");
  assert(suggestion.confidence === "high", "High confidence mapping");

  const ambiguous = suggestColumnMapping(["Name", "Phone", "Mobile"]);
  assert(ambiguous.requiresManualMapping, "Ambiguous mapping requires manual review");
}

function testValidationAndDuplicates() {
  const rows = [
    { Name: "Alice", Phone: "0244111111" },
    { Name: "Bob", Phone: "0244222222" },
    { Name: "", Phone: "0244333333" },
    { Name: "Duplicate", Phone: "0244111111" },
    { Name: "Existing", Phone: "0244999999" },
  ];

  const result = validateImportRows(
    rows,
    { nameColumn: "Name", phoneColumn: "Phone" },
    new Set(["+233244999999"]),
  );

  assert(result.totalRows === 5, "Total rows");
  assert(result.validRows.length === 2, "Valid rows");
  assert(result.invalidRows.length === 1, "Invalid rows");
  assert(result.duplicateRows.length === 2, "Duplicate rows");
}

function testLargeImportPerformance() {
  const rows = Array.from({ length: 1500 }, (_, index) => ({
    Name: `Contact ${index + 1}`,
    Phone: `0${24}${String(index).padStart(7, "0")}`,
  }));

  const started = performance.now();
  const result = validateImportRows(
    rows,
    { nameColumn: "Name", phoneColumn: "Phone" },
    new Set(),
  );
  const elapsed = performance.now() - started;

  assert(result.totalRows === 1500, "Large import row count");
  assert(result.validRows.length === 1500, "Large import valid count");
  assert(elapsed < 2000, `Large import validation too slow: ${elapsed}ms`);
}

function testContactImportTemplate() {
  assert(
    CONTACT_IMPORT_TEMPLATE_FILENAME.endsWith(".xlsx"),
    "Template filename uses xlsx extension",
  );

  const parsed = parseSpreadsheetBuffer(buildContactImportTemplateBuffer());
  assert(parsed.headers.includes(CONTACT_IMPORT_TEMPLATE_COLUMNS.name), "Template has Name column");
  assert(
    parsed.headers.includes(CONTACT_IMPORT_TEMPLATE_COLUMNS.phone),
    "Template has Phone Number column",
  );
  assert(parsed.rows.length >= 3, "Template includes sample rows");

  const suggestion = suggestColumnMapping(parsed.headers);
  assert(suggestion.confidence === "high", "Template columns auto-detect with high confidence");
}

function main() {
  testPhoneNormalization();
  testColumnMapping();
  testValidationAndDuplicates();
  testLargeImportPerformance();
  testContactImportTemplate();
  console.log("Phase 3 import tests passed.");
}

main();
