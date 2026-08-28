import { z } from "zod";
import { MINISTRY_ROLES } from "@/types/domain";

export const BIRTHDAY_PERIODS = ["all", "month", "quarter"] as const;

export type BirthdayPeriod = (typeof BIRTHDAY_PERIODS)[number];

export const birthdayFilterSchema = z
  .object({
    period: z.enum(BIRTHDAY_PERIODS).default("month"),
    month: z.coerce.number().min(1).max(12).optional(),
    quarter: z.coerce.number().min(1).max(4).optional(),
    role: z.enum(["ALL", ...MINISTRY_ROLES]).default("ALL"),
  })
  .superRefine((values, ctx) => {
    if (values.period === "month" && !values.month) {
      ctx.addIssue({
        code: "custom",
        message: "Select a month.",
        path: ["month"],
      });
    }

    if (values.period === "quarter" && !values.quarter) {
      ctx.addIssue({
        code: "custom",
        message: "Select a quarter.",
        path: ["quarter"],
      });
    }
  });

export type BirthdayFilterValues = z.infer<typeof birthdayFilterSchema>;

export function parseBirthdayFilters(
  params: Record<string, string | string[] | undefined>,
  getParam: (key: string) => string | undefined,
): BirthdayFilterValues {
  const period = (getParam("period") ?? "month") as BirthdayPeriod;
  const currentMonth = new Date().getMonth() + 1;

  return birthdayFilterSchema.parse({
    period,
    month:
      period === "month"
        ? getParam("month") ?? String(currentMonth)
        : undefined,
    quarter:
      period === "quarter" ? getParam("quarter") ?? "1" : undefined,
    role: getParam("role") ?? "ALL",
  });
}
