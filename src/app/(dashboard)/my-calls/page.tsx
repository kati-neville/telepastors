import Link from "next/link";
import { List, PhoneCall } from "lucide-react";
import { requireMyCallsAccess } from "@/app/actions/calls";
import { CallStatsGrid } from "@/components/calls/call-stats-grid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchCallQueueStats } from "@/lib/queries/calls";

export default async function MyCallsPage() {
  const { session, context } = await requireMyCallsAccess();
  const stats = await fetchCallQueueStats(context);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          My Calls
        </h2>
        <p className="text-sm text-muted-foreground">
          Work through your assigned contacts quickly from your phone.
        </p>
      </div>

      <CallStatsGrid stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to call?</CardTitle>
          <CardDescription>
            {stats.remaining} contact{stats.remaining === 1 ? "" : "s"} waiting
            for a response.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button
            className="min-h-14 text-base"
            size="lg"
            disabled={stats.assigned === 0}
            render={<Link href="/my-calls/queue" />}
          >
            <PhoneCall />
            Start Calling
          </Button>
          <Button
            variant="outline"
            className="min-h-14 text-base"
            size="lg"
            render={<Link href="/my-calls/list" />}
          >
            <List />
            Contact List
          </Button>
        </CardContent>
      </Card>

      {stats.assigned === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-heading text-lg font-semibold">
            No contacts assigned yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Contacts will appear here once your leader assigns them to you,{" "}
            {session.telepastor.name.split(" ")[0]}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
