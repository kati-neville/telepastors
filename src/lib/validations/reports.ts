import { z } from "zod";
import { CALL_RESPONSES } from "@/types/domain";

export const reportFilterSchema = z.object({
  campaignId: z.string().uuid().optional(),
  governorId: z.string().uuid().optional(),
  leaderId: z.string().uuid().optional(),
  telepastorId: z.string().uuid().optional(),
  response: z.enum(CALL_RESPONSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ReportFilterValues = z.infer<typeof reportFilterSchema>;
