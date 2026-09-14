import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CreateTelepastorForm } from "@/components/telepastors/create-telepastor-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAssignableRolesForCreate } from "@/lib/auth/hierarchy";
import { enforcePageAccess } from "@/lib/auth/guards";
import { canCreateTelepastor } from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import {
  fetchGovernorOptions,
  fetchLeaderOptions,
} from "@/lib/queries/telepastors";
import type { TelepastorSummary } from "@/types/domain";

export default async function NewTelepastorPage() {
  await enforcePageAccess("/telepastors");
  const session = await requireAuthSession();

  if (!canCreateTelepastor({ telepastor: session.telepastor })) {
    redirect("/telepastors");
  }

  const assignableRoles = getAssignableRolesForCreate(
    session.telepastor.role,
  ) as Array<"GOVERNOR" | "LEADER" | "TELEPASTOR">;

  const actorSummary: TelepastorSummary = {
    id: session.telepastor.id,
    name: session.telepastor.name,
    role: session.telepastor.role,
    governor_id: session.telepastor.governor_id,
    leader_id: session.telepastor.leader_id,
  };

  const [governors, leaders] = await Promise.all([
    session.telepastor.role === "SUPER_ADMIN"
      ? fetchGovernorOptions()
      : session.telepastor.role === "GOVERNOR"
        ? Promise.resolve([actorSummary])
        : Promise.resolve([]),
    session.telepastor.role === "LEADER"
      ? Promise.resolve([])
      : fetchLeaderOptions(
          session.telepastor.role === "GOVERNOR"
            ? session.telepastor.id
            : undefined,
        ),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href="/telepastors" />}
      >
        <ChevronLeft />
        Back to directory
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Add Telepastor</CardTitle>
          <CardDescription>
            Create a new ministry member with the essential details. Extended
            profile information can be added later. You can also{" "}
            <Link
              href="/telepastors/import"
              className="underline underline-offset-4"
            >
              bulk import from Excel
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTelepastorForm
            governors={governors}
            leaders={leaders}
            assignableRoles={assignableRoles}
            actorId={session.telepastor.id}
            actorRole={session.telepastor.role}
            actorGovernorId={session.telepastor.governor_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
