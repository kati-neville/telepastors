import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCampaignImportAccess } from "@/app/actions/campaigns";
import { ContactImportWizard } from "@/components/campaigns/contact-import-wizard";
import { Button } from "@/components/ui/button";

type ImportCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImportCampaignPage({
  params,
}: ImportCampaignPageProps) {
  const { id } = await params;
  const { campaign } = await requireCampaignImportAccess(id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href={`/campaigns/${campaign.id}`} />}
      >
        <ChevronLeft />
        Back to campaign
      </Button>

      <ContactImportWizard
        campaignId={campaign.id}
        campaignName={campaign.name}
      />
    </div>
  );
}
