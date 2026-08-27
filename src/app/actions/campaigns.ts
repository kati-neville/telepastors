"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canCreateCampaign,
  canEditCampaign,
  canImportCampaignContacts,
  canManageCampaign,
} from "@/lib/auth/permissions";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import { validateColumnMapping } from "@/lib/excel/column-mapping";
import {
  buildContactImportTemplateBuffer,
  CONTACT_IMPORT_TEMPLATE_FILENAME,
} from "@/lib/excel/contact-import-template";
import {
  IMPORT_BATCH_SIZE,
  parseSpreadsheetBuffer,
  validateImportRows,
  type ValidatedImportRow,
} from "@/lib/excel/parse-contacts";
import { fetchCampaignById } from "@/lib/queries/campaigns";
import {
  fetchContactImportById,
  fetchExistingNormalizedPhones,
} from "@/lib/queries/contacts";
import { createClient } from "@/lib/supabase/server";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  campaignFormSchema,
  columnMappingSchema,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/campaigns";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateCampaignPaths(campaignId?: string) {
  revalidatePath("/campaigns");
  if (campaignId) {
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/edit`);
    revalidatePath(`/campaigns/${campaignId}/import`);
  }
}

export async function createCampaignAction(
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canCreateCampaign(context)) {
    return { success: false, error: "You are not allowed to create campaigns." };
  }

  const parsed = campaignFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid campaign data.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      event_date: parsed.data.event_date || null,
      status: parsed.data.status,
      created_by: session.telepastor.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to create campaign."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.CAMPAIGN_CREATED,
    entityType: "campaign",
    entityId: data.id,
    metadata: {
      name: parsed.data.name,
      status: parsed.data.status,
    },
  });

  revalidateCampaignPaths(data.id);
  redirect(`/campaigns/${data.id}`);
}

export async function updateCampaignAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canEditCampaign(context)) {
    return { success: false, error: "You are not allowed to edit campaigns." };
  }

  const campaign = await fetchCampaignById(id);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const parsed = campaignFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid campaign data.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      event_date: parsed.data.event_date || null,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: toActionErrorMessage(error, "Unable to update campaign."),
    };
  }

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.CAMPAIGN_UPDATED,
    entityType: "campaign",
    entityId: id,
    metadata: {
      name: parsed.data.name,
      status: parsed.data.status,
    },
  });

  revalidateCampaignPaths(id);
  return { success: true };
}

export type ImportPreviewResult = {
  importId: string;
  fileName: string;
  headers: string[];
  mapping: { nameColumn: string; phoneColumn: string };
  requiresManualMapping: boolean;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    missingNameRows: number;
    missingPhoneRows: number;
  };
  problemRows: ValidatedImportRow[];
  previewRows: ValidatedImportRow[];
};

function validateImportFile(file: File): string | null {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

  if (
    !ACCEPTED_IMPORT_TYPES.includes(file.type) &&
    !ACCEPTED_IMPORT_EXTENSIONS.includes(extension)
  ) {
    return "Please upload an Excel file (.xlsx or .xls).";
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return "File must be 10MB or smaller.";
  }

  return null;
}

export async function parseImportPreviewAction(
  formData: FormData,
): Promise<ActionResult<ImportPreviewResult>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canImportCampaignContacts(context)) {
    return {
      success: false,
      error: "Only Super Admins can import campaign contacts.",
    };
  }

  const campaignId = formData.get("campaignId");
  const file = formData.get("file");
  const nameColumn = formData.get("nameColumn");
  const phoneColumn = formData.get("phoneColumn");

  if (typeof campaignId !== "string") {
    return { success: false, error: "Campaign is required." };
  }

  if (!(file instanceof File)) {
    return { success: false, error: "Excel file is required." };
  }

  const fileError = validateImportFile(file);
  if (fileError) {
    return { success: false, error: fileError };
  }

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const buffer = await file.arrayBuffer();
  const parsedSheet = parseSpreadsheetBuffer(buffer);

  if (parsedSheet.headers.length === 0 || parsedSheet.rows.length === 0) {
    return {
      success: false,
      error: "The uploaded file has no rows to import.",
    };
  }

  const mappingResult = columnMappingSchema.safeParse({
    nameColumn: typeof nameColumn === "string" ? nameColumn : "",
    phoneColumn: typeof phoneColumn === "string" ? phoneColumn : "",
  });

  if (!mappingResult.success) {
    return {
      success: false,
      error: "Select which columns contain the contact name and phone number.",
    };
  }

  const mappingError = validateColumnMapping(
    parsedSheet.headers,
    mappingResult.data,
  );

  if (mappingError) {
    return { success: false, error: mappingError };
  }

  const existingPhones = await fetchExistingNormalizedPhones(campaignId);
  const validation = validateImportRows(
    parsedSheet.rows,
    mappingResult.data,
    existingPhones,
  );

  const supabase = await createClient();

  const { data: importRecord, error: importError } = await supabase
    .from("contact_imports")
    .insert({
      campaign_id: campaignId,
      imported_by: session.telepastor.id,
      file_name: file.name,
      status: "PREVIEW",
      total_rows: validation.totalRows,
      valid_rows: validation.validRows.length,
      invalid_rows: validation.invalidRows.length,
      duplicate_rows: validation.duplicateRows.length,
      column_mapping: mappingResult.data,
      preview_data: {
        rows: validation.rows,
        headers: parsedSheet.headers,
      },
      error_summary: {
        missingNameRows: validation.missingNameRows,
        missingPhoneRows: validation.missingPhoneRows,
      },
    })
    .select("id")
    .single();

  if (importError || !importRecord) {
    return {
      success: false,
      error: toActionErrorMessage(importError, "Unable to create import preview."),
    };
  }

  const problemRows = validation.rows.filter((row) => row.status !== "valid");

  return {
    success: true,
    data: {
      importId: importRecord.id,
      fileName: file.name,
      headers: parsedSheet.headers,
      mapping: mappingResult.data,
      requiresManualMapping: false,
      summary: {
        totalRows: validation.totalRows,
        validCount: validation.validRows.length,
        invalidCount: validation.invalidRows.length,
        duplicateCount: validation.duplicateRows.length,
        missingNameRows: validation.missingNameRows,
        missingPhoneRows: validation.missingPhoneRows,
      },
      problemRows,
      previewRows: validation.rows.slice(0, 100),
    },
  };
}

export async function confirmImportAction(
  importId: string,
): Promise<ActionResult<{ importedRows: number }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canImportCampaignContacts(context)) {
    return {
      success: false,
      error: "Only Super Admins can import campaign contacts.",
    };
  }

  const importRecord = await fetchContactImportById(importId);

  if (!importRecord || importRecord.status !== "PREVIEW") {
    return { success: false, error: "Import preview not found or already processed." };
  }

  const previewData = importRecord.preview_data as {
    rows?: ValidatedImportRow[];
  } | null;

  const rows = previewData?.rows ?? [];
  const validRows = rows.filter((row) => row.status === "valid");

  const supabase = await createClient();

  let importedRows = 0;

  for (let index = 0; index < validRows.length; index += IMPORT_BATCH_SIZE) {
    const batch = validRows.slice(index, index + IMPORT_BATCH_SIZE);
    const payload = batch.map((row) => ({
      campaign_id: importRecord.campaign_id,
      name: row.name,
      phone: row.phone,
      phone_normalized: row.phoneNormalized!,
      import_id: importRecord.id,
      import_row_number: row.rowNumber,
      import_metadata: {
        source_file: importRecord.file_name,
        column_mapping: importRecord.column_mapping,
      },
    }));

    const { error } = await supabase.from("contacts").insert(payload);

    if (error) {
      const clientMessage = toActionErrorMessage(
        error,
        "Import failed while saving contacts.",
      );

      await supabase
        .from("contact_imports")
        .update({
          status: "FAILED",
          error_summary: {
            message: error instanceof Error ? error.message : clientMessage,
            importedRows,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      return {
        success: false,
        error:
          importedRows > 0
            ? `Import failed after ${importedRows} contacts. ${clientMessage}`
            : clientMessage,
      };
    }

    importedRows += batch.length;
  }

  const { error: updateError } = await supabase
    .from("contact_imports")
    .update({
      status: "COMPLETED",
      imported_rows: importedRows,
      preview_data: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (updateError) {
    return {
      success: false,
      error: toActionErrorMessage(updateError, "Import completed but failed to finalize."),
    };
  }

  revalidateCampaignPaths(importRecord.campaign_id);

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.CONTACTS_IMPORTED,
    entityType: "contact_import",
    entityId: importId,
    metadata: {
      campaignId: importRecord.campaign_id,
      fileName: importRecord.file_name,
      importedRows,
    },
  });

  return {
    success: true,
    data: { importedRows },
  };
}

export async function requireCampaignAccess(id: string) {
  const session = await requireAuthSession();
  const campaign = await fetchCampaignById(id);

  if (!campaign || !canManageCampaign({ telepastor: session.telepastor })) {
    redirect("/campaigns");
  }

  return { session, campaign };
}

export async function requireCampaignImportAccess(id: string) {
  const { session, campaign } = await requireCampaignAccess(id);

  if (!canImportCampaignContacts({ telepastor: session.telepastor })) {
    redirect(`/campaigns/${id}`);
  }

  return { session, campaign };
}

export async function parseImportHeadersAction(
  formData: FormData,
): Promise<
  ActionResult<{
    headers: string[];
    suggestion: ReturnType<
      typeof import("@/lib/excel/column-mapping").suggestColumnMapping
    >;
    rowCount: number;
    fileName: string;
  }>
> {
  const session = await requireAuthSession();

  if (!canImportCampaignContacts({ telepastor: session.telepastor })) {
    return {
      success: false,
      error: "Only Super Admins can import campaign contacts.",
    };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { success: false, error: "Excel file is required." };
  }

  const fileError = validateImportFile(file);
  if (fileError) {
    return { success: false, error: fileError };
  }

  const { suggestColumnMapping } = await import("@/lib/excel/column-mapping");
  const buffer = await file.arrayBuffer();
  const parsedSheet = parseSpreadsheetBuffer(buffer);

  if (parsedSheet.headers.length === 0) {
    return { success: false, error: "The uploaded file has no columns." };
  }

  const suggestion = suggestColumnMapping(parsedSheet.headers);

  return {
    success: true,
    data: {
      headers: parsedSheet.headers,
      suggestion,
      rowCount: parsedSheet.rows.length,
      fileName: file.name,
    },
  };
}

export async function downloadContactImportTemplateAction(): Promise<
  ActionResult<{ base64: string; filename: string }>
> {
  await requireAuthSession();

  const buffer = buildContactImportTemplateBuffer();

  return {
    success: true,
    data: {
      base64: Buffer.from(buffer).toString("base64"),
      filename: CONTACT_IMPORT_TEMPLATE_FILENAME,
    },
  };
}
