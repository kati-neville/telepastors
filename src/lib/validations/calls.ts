import { z } from "zod";
import { CALL_RESPONSES } from "@/types/domain";

export const recordCallAttemptSchema = z
  .object({
    contactId: z.string().uuid(),
    response: z.enum(CALL_RESPONSES),
    notes: z.string().trim().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.response === "OTHER" && !values.notes?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Please add notes when selecting Other.",
        path: ["notes"],
      });
    }
  });

export type RecordCallAttemptValues = z.infer<typeof recordCallAttemptSchema>;

export const assignedContactsFilterSchema = z.object({
  q: z.string().optional(),
  campaignId: z.string().uuid().optional(),
});

export const fetchNextQueueContactsSchema = z.object({
  campaignId: z.string().uuid().optional(),
  skipContactIds: z.array(z.string().uuid()).max(5000).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

export type AssignedContactsFilterValues = z.infer<
  typeof assignedContactsFilterSchema
>;
