import { z } from "zod";
import { CALL_RESPONSES } from "@/types/domain";

export const TEAM_PERFORMANCE_VIEWS = [
  "governor",
  "leader",
  "telepastor",
] as const;

export type TeamPerformanceView = (typeof TEAM_PERFORMANCE_VIEWS)[number];

export const reportFilterSchema = z.object({
  campaignId: z.string().uuid().optional(),
  governorId: z.string().uuid().optional(),
  leaderId: z.string().uuid().optional(),
  telepastorId: z.string().uuid().optional(),
  response: z.enum(CALL_RESPONSES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  view: z.enum(TEAM_PERFORMANCE_VIEWS).optional(),
});

export type ReportFilterValues = z.infer<typeof reportFilterSchema>;
