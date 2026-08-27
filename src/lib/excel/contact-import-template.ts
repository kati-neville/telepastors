import * as XLSX from "xlsx";

export const CONTACT_IMPORT_TEMPLATE_FILENAME =
  "telepastors-contact-import-template.xlsx";

export const CONTACT_IMPORT_TEMPLATE_COLUMNS = {
  name: "Name",
  phone: "Phone Number",
} as const;

const SAMPLE_ROWS = [
  {
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.name]: "Kwame Mensah",
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.phone]: "0244123456",
  },
  {
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.name]: "Ama Boateng",
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.phone]: "+233244987654",
  },
  {
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.name]: "John Smith",
    [CONTACT_IMPORT_TEMPLATE_COLUMNS.phone]: "+14155552671",
  },
];

const INSTRUCTION_ROWS = [
  ["Telepastors contact import template"],
  [],
  ["Required columns"],
  ["Name", "Full name of the contact (required on every row)."],
  ["Phone Number", "Contact phone number (required on every row)."],
  [],
  ["Accepted phone formats"],
  ["Local Ghana", "0244123456"],
  ["International Ghana", "+233244123456 or 233244123456"],
  ["Without leading zero", "244123456 (9 digits)"],
  ["Other countries", "+14155552671"],
  [],
  ["Before you import"],
  ["1", "Replace the sample rows with your real contact list."],
  ["2", "Keep one contact per row. Do not merge cells."],
  ["3", "Remove completely blank rows."],
  ["4", "Duplicate phone numbers in the file or campaign are skipped."],
  ["5", "Save as .xlsx or .xls (max 10 MB)."],
];

export function buildContactImportTemplateBuffer(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  const contactsSheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS);
  contactsSheet["!cols"] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, contactsSheet, "Contacts");

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS);
  instructionsSheet["!cols"] = [{ wch: 24 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
