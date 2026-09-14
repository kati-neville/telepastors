import Link from "next/link";
import { Plus } from "lucide-react";
import { CampaignCards } from "@/components/campaigns/campaign-cards";
import { ClearAllContactsSection } from "@/components/campaigns/clear-all-contacts-section";
import {
  CampaignsEmptyState,
  CampaignsTable,
} from "@/components/campaigns/campaigns-table";
import { Button } from "@/components/ui/button";
import { enforcePageAccess } from "@/lib/auth/guards";
import {
  canClearAllContacts,
  canCreateCampaign,
} from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import { fetchCampaignSummaries } from "@/lib/queries/campaigns";

export default async function CampaignsPage() {
  await enforcePageAccess("/campaigns");
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const campaigns = await fetchCampaignSummaries();
  const canCreate = canCreateCampaign(context);
  const canClearContacts = canClearAllContacts(context);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Campaigns
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage calling exercises and import contact lists.
          </p>
        </div>
        {canCreate ? (
          <Button render={<Link href="/campaigns/new" />}>
            <Plus />
            New campaign
          </Button>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <CampaignsEmptyState canCreate={canCreate} />
      ) : (
        <>
          <CampaignsTable campaigns={campaigns} />
          <CampaignCards campaigns={campaigns} />
        </>
      )}

      {canClearContacts ? <ClearAllContactsSection /> : null}
    </div>
  );
}
