import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { enforcePageAccess } from "@/lib/auth/guards";
import { canCreateCampaign } from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function NewCampaignPage() {
  await enforcePageAccess("/campaigns");
  const session = await requireAuthSession();

  if (!canCreateCampaign({ telepastor: session.telepastor })) {
    redirect("/campaigns");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" className="px-0" render={<Link href="/campaigns" />}>
        <ChevronLeft />
        Back to campaigns
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Create campaign</CardTitle>
          <CardDescription>
            Set up a new calling or follow-up exercise for the ministry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignForm />
        </CardContent>
      </Card>
    </div>
  );
}
