import Link from "next/link";
import { ChevronLeft, Share2 } from "lucide-react";
import { requireCampaignDistributionAccess } from "@/app/actions/assignments";
import { DistributionPanel } from "@/components/assignments/distribution-panel";
import { Button } from "@/components/ui/button";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import {
  fetchAssignableMembers,
  fetchDistributionContacts,
  fetchDistributionStats,
} from "@/lib/queries/assignments";
import { distributionFilterSchema } from "@/lib/validations/assignments";

type DistributePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function CampaignDistributePage({
  params,
  searchParams,
}: DistributePageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { session, campaign, context } =
    await requireCampaignDistributionAccess(id);

  const filters = distributionFilterSchema.parse({
    q: getParam(resolvedSearchParams, "q"),
    pool: getParam(resolvedSearchParams, "pool") ?? "all",
  });

  const [stats, contacts, assignees] = await Promise.all([
    fetchDistributionStats(id, context),
    fetchDistributionContacts(id, context, filters),
    fetchAssignableMembers(context),
  ]);

  const assigneeLabel = getAssigneeLabel(session.telepastor.role);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href={`/campaigns/${campaign.id}`} />}
      >
        <ChevronLeft />
        Back to campaign
      </Button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Share2 className="size-5 text-muted-foreground" />
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Distribute contacts
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {campaign.name} — assign contacts to {assigneeLabel.toLowerCase()}s in
          your ministry hierarchy. Assignment history is preserved on every
          transfer.
        </p>
      </div>

      <DistributionPanel
        campaignId={campaign.id}
        campaignName={campaign.name}
        actorRole={session.telepastor.role}
        stats={stats}
        contacts={contacts}
        assignees={assignees}
        initialSearch={filters.q ?? ""}
        initialPool={filters.pool}
      />
    </div>
  );
}
