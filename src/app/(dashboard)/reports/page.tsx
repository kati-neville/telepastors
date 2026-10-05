import { requireReportsAccess } from "@/app/actions/reports";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { fetchLeadershipDashboard } from "@/lib/queries/reports";

export default async function ReportsPage() {
  const { session, context } = await requireReportsAccess();
  const data = await fetchLeadershipDashboard(context, {});
  const role = session.telepastor.role as "SUPER_ADMIN" | "GOVERNOR" | "LEADER";

  return <ReportsPageClient initialData={data} role={role} />;
}
