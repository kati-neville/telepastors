import * as XLSX from "xlsx";

export type CampaignContactExportRow = {
  name: string;
  phone: string;
  phoneNormalized: string;
  assignmentStatus: string;
  assigneeName: string | null;
  latestResponse: string | null;
  latestNotes: string | null;
  heldForOwnCalls: boolean;
  createdAt: string;
};

export function buildCampaignContactsExportFilename(campaignName: string) {
  const slug = campaignName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const date = new Date().toISOString().slice(0, 10);
  return `${slug || "campaign"}-contacts-${date}.xlsx`;
}

export function buildCampaignContactsExportBuffer(
  rows: CampaignContactExportRow[],
): ArrayBuffer {
  const sheetRows = rows.map((row) => ({
    Name: row.name,
    "Phone Number": row.phone,
    "Phone Normalized": row.phoneNormalized,
    "Assignment Status": row.assignmentStatus,
    Assignee: row.assigneeName ?? "",
    "Latest Response": row.latestResponse ?? "",
    "Latest Notes": row.latestNotes ?? "",
    "Kept for Calls": row.heldForOwnCalls ? "Yes" : "No",
    "Created At": row.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 40 },
    { wch: 14 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
