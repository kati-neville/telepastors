import * as XLSX from "xlsx";
import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { CallResponse } from "@/types/domain";

export const CAMPAIGN_CONTACT_EXPORT_KINDS = [
  "all",
  "attempted",
  "unattempted",
] as const;

export type CampaignContactExportKind =
  (typeof CAMPAIGN_CONTACT_EXPORT_KINDS)[number];

export type CampaignContactExportRow = {
  name: string;
  phone: string;
  phoneNormalized: string;
  assignmentStatus: string;
  assigneeName: string | null;
  latestResponse: string | null;
  latestNotes: string | null;
  latestResponseAt: string | null;
  recordedByName: string | null;
  attemptCount: number;
  lastAttemptedAt: string | null;
  heldForOwnCalls: boolean;
  createdAt: string;
};

export function isCampaignContactAttempted(row: CampaignContactExportRow) {
  return Boolean(row.latestResponse) || row.attemptCount > 0;
}

export function filterCampaignContactsForExport(
  rows: CampaignContactExportRow[],
  kind: CampaignContactExportKind,
) {
  if (kind === "attempted") {
    return rows.filter(isCampaignContactAttempted);
  }
  if (kind === "unattempted") {
    return rows.filter((row) => !isCampaignContactAttempted(row));
  }
  return rows;
}

function campaignSlug(campaignName: string) {
  return campaignName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildCampaignContactsExportFilename(
  campaignName: string,
  kind: CampaignContactExportKind = "all",
) {
  const slug = campaignSlug(campaignName);
  const date = new Date().toISOString().slice(0, 10);
  const suffix =
    kind === "attempted"
      ? "attempted"
      : kind === "unattempted"
        ? "unattempted"
        : "contacts";
  return `${slug || "campaign"}-${suffix}-${date}.xlsx`;
}

function formatResponse(value: string | null) {
  if (!value) {
    return "";
  }
  return CALL_RESPONSE_LABELS[value as CallResponse] ?? value;
}

const EXPORT_HEADERS = [
  "Name",
  "Phone Number",
  "Phone Normalized",
  "Assignment Status",
  "Assignee",
  "Latest Response",
  "Latest Notes",
  "Latest Response At",
  "Recorded By",
  "Attempt Count",
  "Last Attempted At",
  "Kept for Calls",
  "Created At",
] as const;

function toSheetRow(row: CampaignContactExportRow) {
  return {
    Name: row.name,
    "Phone Number": row.phone,
    "Phone Normalized": row.phoneNormalized,
    "Assignment Status": row.assignmentStatus,
    Assignee: row.assigneeName ?? "",
    "Latest Response": formatResponse(row.latestResponse),
    "Latest Notes": row.latestNotes ?? "",
    "Latest Response At": row.latestResponseAt ?? "",
    "Recorded By": row.recordedByName ?? "",
    "Attempt Count": row.attemptCount,
    "Last Attempted At": row.lastAttemptedAt ?? "",
    "Kept for Calls": row.heldForOwnCalls ? "Yes" : "No",
    "Created At": row.createdAt,
  };
}

export function buildCampaignContactsExportBuffer(
  rows: CampaignContactExportRow[],
): ArrayBuffer {
  const sheetRows = rows.map(toSheetRow);
  const worksheet =
    sheetRows.length > 0
      ? XLSX.utils.json_to_sheet(sheetRows)
      : XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS]]);

  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 40 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
