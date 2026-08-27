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
import { enforcePageAccess } from "@/lib/auth/guards";
import { canCreateTelepastor } from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import {
  fetchGovernorOptions,
  fetchLeaderOptions,
} from "@/lib/queries/telepastors";

export default async function NewTelepastorPage() {
  await enforcePageAccess("/telepastors");
  const session = await requireAuthSession();

  if (!canCreateTelepastor({ telepastor: session.telepastor })) {
    redirect("/telepastors");
  }

  const [governors, leaders] = await Promise.all([
    fetchGovernorOptions(),
    fetchLeaderOptions(),
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
            profile information can be added later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTelepastorForm governors={governors} leaders={leaders} />
        </CardContent>
      </Card>
    </div>
  );
}
