import * as XLSX from "xlsx";

export const TELEPASTOR_IMPORT_TEMPLATE_FILENAME =
  "telepastors-member-import-template.xlsx";

export const TELEPASTOR_IMPORT_TEMPLATE_COLUMNS = {
  name: "Name",
  phone: "Phone",
  address: "Address",
  role: "Role",
  leaderPhone: "Leader Phone",
  governorPhone: "Governor Phone",
} as const;

const SAMPLE_ROWS = [
  {
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.name]: "Ama Mensah",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.phone]: "0244111001",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.address]: "Accra, Ghana",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.role]: "TELEPASTOR",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.leaderPhone]: "0244222002",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.governorPhone]: "",
  },
  {
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.name]: "Kojo Asante",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.phone]: "0244333003",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.address]: "Kumasi, Ghana",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.role]: "LEADER",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.leaderPhone]: "",
    [TELEPASTOR_IMPORT_TEMPLATE_COLUMNS.governorPhone]: "0244444004",
  },
];

const INSTRUCTION_ROWS = [
  ["Telepastors member import template"],
  [],
  ["Required columns"],
  ["Name", "Full name of the ministry member (required)."],
  ["Phone", "Member phone number used for sign-in (required, unique)."],
  ["Address", "Home or ministry address (required)."],
  ["Role", "One of: GOVERNOR, LEADER, TELEPASTOR (not SUPER_ADMIN)."],
  [
    "Leader Phone",
    "Required for TELEPASTOR rows. Must match an existing Leader phone.",
  ],
  [
    "Governor Phone",
    "Required for LEADER rows. Must match an existing Governor phone.",
  ],
  [],
  ["Who can import"],
  ["Super Admin", "Can import Governors, Leaders, and Telepastors."],
  ["Governor", "Can import Leaders under self and Telepastors under their Leaders."],
  ["Leader", "Can import Telepastors assigned to themselves only."],
  [],
  ["Accepted phone formats"],
  ["Local Ghana", "0244123456"],
  ["International Ghana", "+233244123456 or 233244123456"],
  ["Without leading zero", "244123456 (9 digits)"],
  ["Other countries", "+14155552671"],
  [],
  ["After import"],
  [
    "1",
    "Each valid member gets a sign-in account with temporary password: telepastor",
  ],
  ["2", "They must change the password on first login."],
  ["3", "Download the credentials Excel from the import complete screen."],
  ["4", "Duplicates and invalid rows are skipped."],
  ["5", "Save as .xlsx or .xls (max 10 MB)."],
];

export function buildTelepastorImportTemplateBuffer(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  const membersSheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS);
  membersSheet["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, membersSheet, "Telepastors");

  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS);
  instructionsSheet["!cols"] = [{ wch: 24 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export function buildTelepastorCredentialsExportBuffer(
  credentials: Array<{
    name: string;
    phone: string;
    temporaryPassword: string;
    role: string;
    rowNumber: number;
  }>,
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const rows = credentials.map((item) => ({
    "Excel Row": item.rowNumber,
    Name: item.name,
    Phone: item.phone,
    Role: item.role,
    "Temporary Password": item.temporaryPassword,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Credentials");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
