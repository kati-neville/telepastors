"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  confirmImportAction,
  parseImportHeadersAction,
  parseImportPreviewAction,
  type ImportPreviewResult,
} from "@/app/actions/campaigns";
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
import { DownloadContactImportTemplateButton } from "@/components/campaigns/download-contact-import-template-button";
import type { ColumnMappingSuggestion } from "@/lib/excel/column-mapping";
import { CONTACT_IMPORT_TEMPLATE_COLUMNS } from "@/lib/excel/contact-import-template";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/campaigns";

type ImportWizardProps = {
  campaignId: string;
  campaignName: string;
};

type WizardStep = "upload" | "mapping" | "preview" | "complete";

export function ContactImportWizard({
  campaignId,
  campaignName,
}: ImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<ColumnMappingSuggestion | null>(
    null,
  );
  const [nameColumn, setNameColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const accept = useMemo(
    () => ACCEPTED_IMPORT_EXTENSIONS.join(","),
    [],
  );

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
    if (!selectedFile) {
      return;
    }

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
      const result = await parseImportHeadersAction(formData);

      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      if (!result.data) {
        setError("Unable to read the uploaded file.");
        return;
      }

      setHeaders(result.data.headers);
      setSuggestion(result.data.suggestion);
      setNameColumn(result.data.suggestion.nameColumn ?? "");
      setPhoneColumn(result.data.suggestion.phoneColumn ?? "");
      setStep("mapping");
    });
  };

  const handleGeneratePreview = () => {
    if (!file) {
      setError("Select an Excel file to continue.");
      return;
    }

    if (!nameColumn || !phoneColumn) {
      setError("Select both name and phone columns before continuing.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("campaignId", campaignId);
    formData.set("file", file);
    formData.set("nameColumn", nameColumn);
    formData.set("phoneColumn", phoneColumn);

    startTransition(async () => {
      const result = await parseImportPreviewAction(formData);

      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      if (!result.data) {
        setError("Unable to generate import preview.");
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
      const result = await confirmImportAction(preview.importId);

      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      setImportedCount(result.data?.importedRows ?? 0);
      setStep("complete");
      toast.success("Contacts imported successfully");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Import contacts
          </CardTitle>
          <CardDescription>
            Upload an Excel contact list for {campaignName}. Download the
            template, add your contacts, then review validation results before
            confirming the import.
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
                    Use the template columns{" "}
                    <strong className="font-medium text-foreground">
                      {CONTACT_IMPORT_TEMPLATE_COLUMNS.name}
                    </strong>{" "}
                    and{" "}
                    <strong className="font-medium text-foreground">
                      {CONTACT_IMPORT_TEMPLATE_COLUMNS.phone}
                    </strong>
                    .
                  </li>
                  <li>One contact per row. Both name and phone are required.</li>
                  <li>
                    Phone numbers can be local (0244123456), Ghana international
                    (+233244123456), or other country codes (+14155552671).
                  </li>
                  <li>
                    Replace the sample rows with your list. Duplicate numbers
                    in the file or campaign are skipped automatically.
                  </li>
                </ul>
              </div>
              <DownloadContactImportTemplateButton className="shrink-0" />
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
                  or click to browse. Need a starting point? Download the
                  template above.
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
                  We detected columns in your file. Confirm the mappings below
                  before generating the import preview.
                </p>
              </div>

              {suggestion?.requiresManualMapping ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                  Column detection needs your confirmation. Please choose the
                  correct name and phone columns.
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                  Columns were detected with high confidence. Please confirm
                  before continuing.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name column</Label>
                  <Select
                    value={nameColumn}
                    onValueChange={(value) => setNameColumn(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select name column" />
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

                <div className="space-y-2">
                  <Label>Phone column</Label>
                  <Select
                    value={phoneColumn}
                    onValueChange={(value) => setPhoneColumn(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select phone column" />
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
                <p className="font-medium">Step 3: Review import preview</p>
                <p className="text-sm text-muted-foreground">
                  Duplicates and invalid rows will not be imported.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.problemRows.slice(0, 50).map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.name || "—"}</TableCell>
                            <TableCell>{row.phone || "—"}</TableCell>
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
                  All rows passed validation with no duplicates or missing fields.
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
                    `Confirm import (${preview.summary.validCount})`
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
                {importedCount} contacts were added to this campaign.
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/campaigns/${campaignId}`)}
              >
                View campaign
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
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
