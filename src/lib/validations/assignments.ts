import { z } from "zod";

export const ASSIGNMENT_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const assignContactsSchema = z.object({
  campaignId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1, "Select at least one contact"),
  assigneeId: z.string().uuid(),
  notes: z.string().trim().optional(),
});

export type AssignContactsValues = z.infer<typeof assignContactsSchema>;

export const bulkAssignContactsSchema = z.object({
  campaignId: z.string().uuid(),
  retainCount: z.number().int().min(0).default(0),
  assignments: z
    .array(
      z.object({
        assigneeId: z.string().uuid(),
        count: z.number().int().min(0),
      }),
    )
    .min(1, "Select at least one assignee"),
  notes: z.string().trim().optional(),
});

export type BulkAssignContactsValues = z.infer<typeof bulkAssignContactsSchema>;

export const distributionFilterSchema = z.object({
  q: z.string().optional(),
  pool: z.enum(["all", "unassigned", "assigned", "assigned_to_me"]).default("all"),
});

export type DistributionFilterValues = z.infer<typeof distributionFilterSchema>;
