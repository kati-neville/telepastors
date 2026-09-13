"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  confirmTelepastorImportAction,
  downloadTelepastorImportCredentialsAction,
  parseTelepastorImportHeadersAction,
  parseTelepastorImportPreviewAction,
  type TelepastorImportPreviewResult,
} from "@/app/actions/telepastor-import";
import { DownloadTelepastorImportTemplateButton } from "@/components/telepastors/download-telepastor-import-template-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TelepastorImportColumnSuggestion } from "@/lib/excel/telepastor-column-mapping";
import { TELEPASTOR_IMPORT_TEMPLATE_COLUMNS } from "@/lib/excel/telepastor-import-template";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/telepastor-import";
import { DEFAULT_TELEPASTOR_PASSWORD } from "@/lib/auth/default-password";

type WizardStep = "upload" | "mapping" | "preview" | "complete";

export function TelepastorImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [suggestion, setSuggestion] =
    useState<TelepastorImportColumnSuggestion | null>(null);
  const [nameColumn, setNameColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [addressColumn, setAddressColumn] = useState("");
  const [roleColumn, setRoleColumn] = useState("");
  const [leaderPhoneColumn, setLeaderPhoneColumn] = useState("");
  const [governorPhoneColumn, setGovernorPhoneColumn] = useState("");
  const [preview, setPreview] = useState<TelepastorImportPreviewResult | null>(
    null,
  );
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [completedImportId, setCompletedImportId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const accept = useMemo(() => ACCEPTED_IMPORT_EXTENSIONS.join(","), []);
  const defaultPassword = DEFAULT_TELEPASTOR_PASSWORD;

  const validateSelectedFile = (selectedFile: File): string | null => {
    const extension = selectedFile.name
      .toLowerCase()
      .slice(selectedFile.name.lastIndexOf("."));

    if (
      !ACCEPTED_IMPORT_TYPES.includes(selectedFile.type) &&
      !ACCEPTED_IMPORT_EXTENSIONS.includes(extension)
    ) {
      return "Please upload an Excel file (.xlsx or .xls).";
    }

    if (selectedFile.size > MAX_IMPORT_FILE_BYTES) {
      return "File must be 10MB or smaller.";
    }

    return null;
  };

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setPreview(null);
    setError(null);
    setStep("upload");
  };

  const processSelectedFile = (selectedFile: File | null) => {
    if (!selectedFile) return;

    const validationError = validateSelectedFile(selectedFile);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    handleFileSelect(selectedFile);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    processSelectedFile(event.dataTransfer.files[0] ?? null);
  };

  const handleParseHeaders = () => {
    if (!file) {
      setError("Select an Excel file to continue.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await parseTelepastorImportHeadersAction(formData);
      if (!result.success || !result.data) {
        const message = result.success
          ? "Unable to read the uploaded file."
          : result.error;
        setError(message);
        toast.error(message);
        return;
      }

      setHeaders(result.data.headers);
      setSuggestion(result.data.suggestion);
      setNameColumn(result.data.suggestion.nameColumn);
      setPhoneColumn(result.data.suggestion.phoneColumn);
      setAddressColumn(result.data.suggestion.addressColumn);
      setRoleColumn(result.data.suggestion.roleColumn);
      setLeaderPhoneColumn(result.data.suggestion.leaderPhoneColumn);
      setGovernorPhoneColumn(result.data.suggestion.governorPhoneColumn);
      setStep("mapping");
    });
  };

  const handleGeneratePreview = () => {
    if (!file) {
      setError("Select an Excel file to continue.");
      return;
    }

    if (
      !nameColumn ||
      !phoneColumn ||
      !addressColumn ||
      !roleColumn ||
      !leaderPhoneColumn ||
      !governorPhoneColumn
    ) {
      setError("Map all required columns before continuing.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("nameColumn", nameColumn);
    formData.set("phoneColumn", phoneColumn);
    formData.set("addressColumn", addressColumn);
    formData.set("roleColumn", roleColumn);
    formData.set("leaderPhoneColumn", leaderPhoneColumn);
    formData.set("governorPhoneColumn", governorPhoneColumn);

    startTransition(async () => {
      const result = await parseTelepastorImportPreviewAction(formData);
      if (!result.success || !result.data) {
        const message = result.success
          ? "Unable to generate import preview."
          : result.error;
        setError(message);
        toast.error(message);
        return;
      }

      setPreview(result.data);
      setStep("preview");
    });
  };

  const handleConfirmImport = () => {
    if (!preview?.importId) {
      setError("Import preview is missing.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await confirmTelepastorImportAction(preview.importId);
      if (!result.success || !result.data) {
        const message = result.success
          ? "Unable to complete import."
          : result.error;
        setError(message);
        toast.error(message);
        return;
      }

      setImportedCount(result.data.importedRows);
      setFailedCount(result.data.failedRows);
      setCompletedImportId(preview.importId);
      setStep("complete");
      toast.success(
        result.data.failedRows > 0
          ? `Imported ${result.data.importedRows} members (${result.data.failedRows} failed).`
          : "Telepastors imported successfully",
      );
      router.refresh();
    });
  };

  const handleDownloadCredentials = () => {
    if (!completedImportId) return;

    startTransition(async () => {
      const result =
        await downloadTelepastorImportCredentialsAction(completedImportId);
      if (!result.success || !result.data) {
        toast.error(
          result.success ? "Unable to download credentials." : result.error,
        );
        return;
      }

      const bytes = Uint8Array.from(atob(result.data.base64), (char) =>
        char.charCodeAt(0),
      );
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Credentials downloaded.");
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Bulk import Telepastors
          </CardTitle>
          <CardDescription>
            Upload an Excel list of ministry members. Rows are validated for
            duplicates, phone format, role, and leader/governor assignment
            before you approve the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Info className="size-4 text-muted-foreground" />
                  How to prepare your file
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Use columns{" "}
                    {Object.values(TELEPASTOR_IMPORT_TEMPLATE_COLUMNS).map(
                      (column, index, list) => (
                        <span key={column}>
                          <strong className="font-medium text-foreground">
                            {column}
                          </strong>
                          {index < list.length - 1 ? ", " : ""}
                        </span>
                      ),
                    )}
                    .
                  </li>
                  <li>
                    Match Leaders and Governors by phone number (not name).
                  </li>
                  <li>
                    Temporary password for every new account is{" "}
                    <strong className="font-medium text-foreground">
                      {defaultPassword}
                    </strong>
                    . Members must change it on first login.
                  </li>
                  <li>
                    Duplicate phones in the file or directory are skipped.
                  </li>
                </ul>
              </div>
              <DownloadTelepastorImportTemplateButton className="shrink-0" />
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {step === "upload" ? (
            <div className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                  "rounded-xl border border-dashed p-6 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/20",
                )}
              >
                <FileSpreadsheet
                  className={cn(
                    "mx-auto size-10 transition-colors",
                    isDragging ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <p className="mt-3 font-medium">Step 1: Select Excel file</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag and drop your completed Excel file here (.xlsx or .xls),
                  or click to browse.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(event) =>
                    processSelectedFile(event.target.files?.[0] ?? null)
                  }
                />
                {file ? (
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Selected: {file.name}
                  </p>
                ) : isDragging ? (
                  <p className="mt-3 text-sm font-medium text-primary">
                    Drop your Excel file to upload
                  </p>
                ) : null}
              </div>
              <Button onClick={handleParseHeaders} disabled={!file || isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Parsing file...
                  </>
                ) : (
                  <>
                    <Upload />
                    Continue to column mapping
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {step === "mapping" ? (
            <div className="space-y-4">
              <div>
                <p className="font-medium">Step 2: Confirm column mapping</p>
                <p className="text-sm text-muted-foreground">
                  Confirm which spreadsheet columns map to each required field.
                </p>
              </div>

              {suggestion?.requiresManualMapping ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                  Column detection needs your confirmation.
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                  Template columns were detected. Confirm before continuing.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <ColumnSelect
                  label="Name column"
                  value={nameColumn}
                  headers={headers}
                  onChange={setNameColumn}
                />
                <ColumnSelect
                  label="Phone column"
                  value={phoneColumn}
                  headers={headers}
                  onChange={setPhoneColumn}
                />
                <ColumnSelect
                  label="Address column"
                  value={addressColumn}
                  headers={headers}
                  onChange={setAddressColumn}
                />
                <ColumnSelect
                  label="Role column"
                  value={roleColumn}
                  headers={headers}
                  onChange={setRoleColumn}
                />
                <ColumnSelect
                  label="Leader Phone column"
                  value={leaderPhoneColumn}
                  headers={headers}
                  onChange={setLeaderPhoneColumn}
                />
                <ColumnSelect
                  label="Governor Phone column"
                  value={governorPhoneColumn}
                  headers={headers}
                  onChange={setGovernorPhoneColumn}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={handleGeneratePreview} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Validating rows...
                    </>
                  ) : (
                    "Generate preview"
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {step === "preview" && preview ? (
            <div className="space-y-5">
              <div>
                <p className="font-medium">Step 3: Review and approve</p>
                <p className="text-sm text-muted-foreground">
                  Duplicates and invalid rows will not be imported. Approving
                  creates sign-in accounts for every valid row.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryCard label="Total rows" value={preview.summary.totalRows} />
                <SummaryCard label="Valid" value={preview.summary.validCount} />
                <SummaryCard label="Invalid" value={preview.summary.invalidCount} />
                <SummaryCard
                  label="Duplicates"
                  value={preview.summary.duplicateCount}
                />
                <SummaryCard
                  label="Missing phones"
                  value={preview.summary.missingPhoneRows}
                />
                <SummaryCard
                  label="Missing address"
                  value={preview.summary.missingAddressRows}
                />
              </div>

              {preview.problemRows.length > 0 ? (
                <div className="space-y-3">
                  <p className="font-medium">Rows with problems</p>
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.problemRows.slice(0, 50).map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.name || "—"}</TableCell>
                            <TableCell>{row.phone || "—"}</TableCell>
                            <TableCell>{row.role || "—"}</TableCell>
                            <TableCell className="text-destructive">
                              {row.errors.join("; ")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.problemRows.length > 50 ? (
                    <p className="text-sm text-muted-foreground">
                      Showing the first 50 problem rows of{" "}
                      {preview.problemRows.length}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                  All rows passed validation with no duplicates or missing
                  fields.
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Back
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={isPending || preview.summary.validCount === 0}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Approve import (${preview.summary.validCount})`
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {step === "complete" ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
              <p className="mt-3 font-heading text-xl font-semibold">
                Import complete
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {importedCount} Telepastors were created
                {failedCount > 0 ? ` (${failedCount} failed during commit)` : ""}
                . Temporary password for new accounts: {defaultPassword}.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  onClick={handleDownloadCredentials}
                  disabled={isPending || !completedImportId}
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  Download credentials
                </Button>
                <Button variant="outline" render={<Link href="/telepastors" />}>
                  View directory
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
    </div>
  );
}
