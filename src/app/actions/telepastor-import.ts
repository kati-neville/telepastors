"use server";

import { revalidatePath } from "next/cache";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { getDefaultTelepastorPassword } from "@/lib/auth/default-password";
import { canBulkImportTelepastors } from "@/lib/auth/permissions";
import {
  deleteAuthUser,
  provisionTelepastorAuthUser,
} from "@/lib/auth/provision-auth-user";
import { requireAuthSession } from "@/lib/auth/session";
import { parseSpreadsheetBuffer } from "@/lib/excel/parse-contacts";
import {
  suggestTelepastorImportColumnMapping,
  validateTelepastorImportColumnMapping,
} from "@/lib/excel/telepastor-column-mapping";
import {
  TELEPASTOR_IMPORT_COMMIT_BATCH_SIZE,
  validateTelepastorImportRows,
  type ValidatedTelepastorImportRow,
} from "@/lib/excel/parse-telepastors";
import {
  buildTelepastorCredentialsExportBuffer,
  buildTelepastorImportTemplateBuffer,
  TELEPASTOR_IMPORT_TEMPLATE_FILENAME,
} from "@/lib/excel/telepastor-import-template";
import { toActionErrorMessage } from "@/lib/errors/client-message";
import {
  fetchExistingTelepastorNormalizedPhones,
  fetchTelepastorImportById,
  fetchTelepastorImportLookups,
} from "@/lib/queries/telepastor-imports";
import { createClient } from "@/lib/supabase/server";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
  telepastorImportColumnMappingSchema,
} from "@/lib/validations/telepastor-import";
import type { TelepastorImportCredential } from "@/types/domain";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type TelepastorImportPreviewResult = {
  importId: string;
  fileName: string;
  headers: string[];
  mapping: {
    nameColumn: string;
    phoneColumn: string;
    addressColumn: string;
    roleColumn: string;
    leaderPhoneColumn: string;
    governorPhoneColumn: string;
  };
  requiresManualMapping: boolean;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    missingNameRows: number;
    missingPhoneRows: number;
    missingAddressRows: number;
  };
  problemRows: ValidatedTelepastorImportRow[];
  previewRows: ValidatedTelepastorImportRow[];
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

export async function parseTelepastorImportHeadersAction(
  formData: FormData,
): Promise<
  ActionResult<{
    headers: string[];
    suggestion: ReturnType<typeof suggestTelepastorImportColumnMapping>;
    rowCount: number;
    fileName: string;
  }>
> {
  const session = await requireAuthSession();

  if (!canBulkImportTelepastors({ telepastor: session.telepastor })) {
    return {
      success: false,
      error: "You are not allowed to import Telepastors.",
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

  const buffer = await file.arrayBuffer();
  const parsedSheet = parseSpreadsheetBuffer(buffer);

  if (parsedSheet.headers.length === 0) {
    return { success: false, error: "The uploaded file has no columns." };
  }

  return {
    success: true,
    data: {
      headers: parsedSheet.headers,
      suggestion: suggestTelepastorImportColumnMapping(parsedSheet.headers),
      rowCount: parsedSheet.rows.length,
      fileName: file.name,
    },
  };
}

export async function parseTelepastorImportPreviewAction(
  formData: FormData,
): Promise<ActionResult<TelepastorImportPreviewResult>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canBulkImportTelepastors(context)) {
    return {
      success: false,
      error: "You are not allowed to import Telepastors.",
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

  const mappingResult = telepastorImportColumnMappingSchema.safeParse({
    nameColumn: formData.get("nameColumn"),
    phoneColumn: formData.get("phoneColumn"),
    addressColumn: formData.get("addressColumn"),
    roleColumn: formData.get("roleColumn"),
    leaderPhoneColumn: formData.get("leaderPhoneColumn"),
    governorPhoneColumn: formData.get("governorPhoneColumn"),
  });

  if (!mappingResult.success) {
    return {
      success: false,
      error: "Confirm all column mappings before continuing.",
    };
  }

  const buffer = await file.arrayBuffer();
  const parsedSheet = parseSpreadsheetBuffer(buffer);

  if (parsedSheet.headers.length === 0 || parsedSheet.rows.length === 0) {
    return {
      success: false,
      error: "The uploaded file has no rows to import.",
    };
  }

  const mappingError = validateTelepastorImportColumnMapping(
    parsedSheet.headers,
    mappingResult.data,
  );
  if (mappingError) {
    return { success: false, error: mappingError };
  }

  const [existingPhones, lookups] = await Promise.all([
    fetchExistingTelepastorNormalizedPhones(),
    fetchTelepastorImportLookups(),
  ]);

  const validation = validateTelepastorImportRows(
    parsedSheet.rows,
    mappingResult.data,
    existingPhones,
    lookups,
    session.telepastor,
  );

  const supabase = await createClient();
  const { data: importRecord, error: importError } = await supabase
    .from("telepastor_imports")
    .insert({
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
        missingAddressRows: validation.missingAddressRows,
      },
    })
    .select("id")
    .single();

  if (importError || !importRecord) {
    return {
      success: false,
      error: toActionErrorMessage(
        importError,
        "Unable to create import preview.",
      ),
    };
  }

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
        missingAddressRows: validation.missingAddressRows,
      },
      problemRows: validation.rows.filter((row) => row.status !== "valid"),
      previewRows: validation.rows.slice(0, 100),
    },
  };
}

export async function confirmTelepastorImportAction(
  importId: string,
): Promise<
  ActionResult<{
    importedRows: number;
    failedRows: number;
    credentials: TelepastorImportCredential[];
  }>
> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canBulkImportTelepastors(context)) {
    return {
      success: false,
      error: "You are not allowed to import Telepastors.",
    };
  }

  const importRecord = await fetchTelepastorImportById(importId);
  if (!importRecord || importRecord.status !== "PREVIEW") {
    return {
      success: false,
      error: "Import preview not found or already processed.",
    };
  }

  if (
    importRecord.imported_by &&
    importRecord.imported_by !== session.telepastor.id &&
    session.telepastor.role !== "SUPER_ADMIN"
  ) {
    return { success: false, error: "You cannot confirm this import." };
  }

  const previewData = importRecord.preview_data as {
    rows?: ValidatedTelepastorImportRow[];
  } | null;
  const rows = previewData?.rows ?? [];
  const validRows = rows.filter(
    (row) =>
      row.status === "valid" &&
      row.role &&
      row.phoneNormalized &&
      row.name &&
      row.address,
  );

  const supabase = await createClient();
  const credentials: TelepastorImportCredential[] = [];
  const commitErrors: string[] = [];
  let importedRows = 0;

  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index]!;
    const temporaryPassword = getDefaultTelepastorPassword();

    const { data: created, error: insertError } = await supabase
      .from("telepastors")
      .insert({
        name: row.name,
        phone: row.phone,
        phone_normalized: row.phoneNormalized!,
        address: row.address,
        role: row.role!,
        leader_id: row.leaderId,
        governor_id: row.governorId,
        is_active: true,
        must_change_password: true,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      commitErrors.push(
        `Row ${row.rowNumber}: ${toActionErrorMessage(insertError, "Unable to create member.")}`,
      );
      continue;
    }

    try {
      const { authUserId } = await provisionTelepastorAuthUser({
        telepastorId: created.id,
        phoneNormalized: row.phoneNormalized!,
        password: temporaryPassword,
      });

      const { error: linkError } = await supabase
        .from("telepastors")
        .update({ auth_user_id: authUserId })
        .eq("id", created.id);

      if (linkError) {
        await deleteAuthUser(authUserId);
        await supabase.from("telepastors").delete().eq("id", created.id);
        commitErrors.push(
          `Row ${row.rowNumber}: ${toActionErrorMessage(linkError, "Unable to link sign-in account.")}`,
        );
        continue;
      }
    } catch (provisionError) {
      await supabase.from("telepastors").delete().eq("id", created.id);
      commitErrors.push(
        `Row ${row.rowNumber}: ${
          provisionError instanceof Error
            ? provisionError.message
            : "Unable to create sign-in account."
        }`,
      );
      continue;
    }

    credentials.push({
      id: created.id,
      name: row.name,
      phone: row.phone,
      temporaryPassword,
      role: row.role!,
      rowNumber: row.rowNumber,
    });
    importedRows += 1;

    if (importedRows % TELEPASTOR_IMPORT_COMMIT_BATCH_SIZE === 0) {
      // Yield to the event loop between batches of Auth provisions.
      await Promise.resolve();
    }
  }

  const failedRows = validRows.length - importedRows;
  const status =
    importedRows === 0 && validRows.length > 0
      ? "FAILED"
      : failedRows > 0 && importedRows > 0
        ? "COMPLETED"
        : importedRows > 0
          ? "COMPLETED"
          : validRows.length === 0
            ? "COMPLETED"
            : "FAILED";

  const { error: updateError } = await supabase
    .from("telepastor_imports")
    .update({
      status,
      imported_rows: importedRows,
      preview_data: null,
      credentials_export: credentials,
      error_summary: {
        ...(typeof importRecord.error_summary === "object" &&
        importRecord.error_summary
          ? importRecord.error_summary
          : {}),
        commitErrors: commitErrors.slice(0, 100),
        failedRows,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (updateError) {
    return {
      success: false,
      error: toActionErrorMessage(
        updateError,
        "Import finished but failed to finalize.",
      ),
    };
  }

  if (importedRows === 0 && validRows.length > 0) {
    return {
      success: false,
      error:
        commitErrors[0] ??
        "Import failed. No Telepastors were created from the valid rows.",
    };
  }

  revalidatePath("/telepastors");
  revalidatePath("/telepastors/import");

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.TELEPASTORS_IMPORTED,
    entityType: "telepastor_import",
    entityId: importId,
    metadata: {
      fileName: importRecord.file_name,
      importedRows,
      failedRows,
    },
  });

  return {
    success: true,
    data: {
      importedRows,
      failedRows,
      credentials,
    },
  };
}

export async function downloadTelepastorImportTemplateAction(): Promise<
  ActionResult<{ base64: string; filename: string }>
> {
  const session = await requireAuthSession();

  if (!canBulkImportTelepastors({ telepastor: session.telepastor })) {
    return {
      success: false,
      error: "You are not allowed to download this template.",
    };
  }

  const buffer = buildTelepastorImportTemplateBuffer();

  return {
    success: true,
    data: {
      base64: Buffer.from(buffer).toString("base64"),
      filename: TELEPASTOR_IMPORT_TEMPLATE_FILENAME,
    },
  };
}

export async function downloadTelepastorImportCredentialsAction(
  importId: string,
): Promise<ActionResult<{ base64: string; filename: string }>> {
  const session = await requireAuthSession();

  if (!canBulkImportTelepastors({ telepastor: session.telepastor })) {
    return {
      success: false,
      error: "You are not allowed to download credentials.",
    };
  }

  const importRecord = await fetchTelepastorImportById(importId);
  if (!importRecord) {
    return { success: false, error: "Import not found." };
  }

  if (
    importRecord.imported_by &&
    importRecord.imported_by !== session.telepastor.id &&
    session.telepastor.role !== "SUPER_ADMIN"
  ) {
    return { success: false, error: "You cannot download these credentials." };
  }

  const credentials =
    (importRecord.credentials_export as TelepastorImportCredential[] | null) ??
    [];

  if (credentials.length === 0) {
    return { success: false, error: "No credentials are available for download." };
  }

  const buffer = buildTelepastorCredentialsExportBuffer(credentials);

  return {
    success: true,
    data: {
      base64: Buffer.from(buffer).toString("base64"),
      filename: `telepastor-import-credentials-${importId.slice(0, 8)}.xlsx`,
    },
  };
}
