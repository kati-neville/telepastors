import { z } from "zod";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const campaignFormSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required"),
  description: z.string().trim().optional(),
  event_date: z.string().nullable().optional(),
  status: z.enum(CAMPAIGN_STATUSES),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const columnMappingSchema = z.object({
  nameColumn: z.string().min(1, "Select a name column"),
  phoneColumn: z.string().min(1, "Select a phone column"),
});

export type ColumnMappingValues = z.infer<typeof columnMappingSchema>;

export const contactsFilterSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "valid"]).default("all"),
});

export type ContactsFilterValues = z.infer<typeof contactsFilterSchema>;

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMPORT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls"];
