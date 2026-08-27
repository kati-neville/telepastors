import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadershipDashboard } from "@/components/dashboard/leadership-dashboard";
import { TelepastorDashboard } from "@/components/calls/telepastor-dashboard";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { getRoleLabel } from "@/lib/auth/roles";
import { requireAuthSession } from "@/lib/auth/session";
import { fetchCallQueueStats } from "@/lib/queries/calls";
import { fetchLeadershipDashboard, fetchTelepastorRecentActivity } from "@/lib/queries/reports";

export default async function DashboardPage() {
  const session = await requireAuthSession();
  const { telepastor } = session;
  const context = { telepastor };

  if (telepastor.role === "TELEPASTOR") {
    const [stats, recentActivity] = await Promise.all([
      fetchCallQueueStats(context),
      fetchTelepastorRecentActivity(telepastor.id),
    ]);

    return (
      <TelepastorDashboard
        stats={stats}
        telepastorName={telepastor.name}
        recentActivity={recentActivity}
      />
    );
  }

  if (
    telepastor.role === "SUPER_ADMIN" ||
    telepastor.role === "GOVERNOR" ||
    telepastor.role === "LEADER"
  ) {
    const data = await fetchLeadershipDashboard(context);
    const performanceTitle =
      telepastor.role === "SUPER_ADMIN"
        ? "Governor performance"
        : telepastor.role === "GOVERNOR"
          ? "Leader & Telepastor progress"
          : "Telepastor performance";

    return (
      <LeadershipDashboard
        data={data}
        performanceTitle={performanceTitle}
      />
    );
  }

  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your ministry workspace is ready."
    >
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signed in as</CardTitle>
            <CardDescription>{session.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{telepastor.name}</p>
            <Badge variant="secondary">{getRoleLabel(telepastor.role)}</Badge>
          </CardContent>
        </Card>
      </div>
    </PlaceholderPage>
  );
}
