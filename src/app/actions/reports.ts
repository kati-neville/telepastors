"use server";

import { redirect } from "next/navigation";
import { canAccessLeadershipReports } from "@/lib/auth/reports";
import { requireAuthSession } from "@/lib/auth/session";
import {
  buildTeamPerformanceCsv,
  fetchLeadershipDashboard,
} from "@/lib/queries/reports";
import { reportFilterSchema } from "@/lib/validations/reports";

export async function requireReportsAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canAccessLeadershipReports(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}

export async function exportTeamPerformanceCsv(filtersInput: unknown) {
  const { context } = await requireReportsAccess();
  const filters = reportFilterSchema.parse(filtersInput ?? {});
  const data = await fetchLeadershipDashboard(context, filters);
  return buildTeamPerformanceCsv(data.teamPerformance);
}
