import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCampaignAccess } from "@/app/actions/campaigns";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEditCampaign } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

type EditCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;
  const { session, campaign } = await requireCampaignAccess(id);

  if (!canEditCampaign({ telepastor: session.telepastor })) {
    redirect(`/campaigns/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href={`/campaigns/${campaign.id}`} />}
      >
        <ChevronLeft />
        Back to campaign
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Edit campaign</CardTitle>
          <CardDescription>
            Update campaign details for {campaign.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignForm campaign={campaign} />
        </CardContent>
      </Card>
    </div>
  );
}
