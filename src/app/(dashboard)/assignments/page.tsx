import { Suspense } from "react";
import { requireAssignmentsAccess } from "@/app/actions/assignments";
import { AssignmentsDistributionHub } from "@/components/assignments/assignments-distribution-hub";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import {
  fetchAssignableMembers,
  fetchCampaignsForDistribution,
  fetchDistributionContacts,
  fetchDistributionStats,
} from "@/lib/queries/assignments";
import { Skeleton } from "@/components/ui/skeleton";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function AssignmentsDistributionSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function AssignmentsDistributionContent({
  initialCampaignId,
}: {
  initialCampaignId?: string;
}) {
  const { session, context } = await requireAssignmentsAccess();
  const [campaigns, assignees] = await Promise.all([
    fetchCampaignsForDistribution(context),
    fetchAssignableMembers(context),
  ]);
  const assigneeLabel = getAssigneeLabel(session.telepastor.role);

  const campaignData = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      stats: await fetchDistributionStats(campaign.id, context),
      contacts: await fetchDistributionContacts(campaign.id, context, {
        pool: "all",
      }),
    })),
  );

  const focusedCampaign = initialCampaignId
    ? campaigns.find((campaign) => campaign.id === initialCampaignId)
    : campaigns.length === 1
      ? campaigns[0]
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {focusedCampaign
            ? `Distribute contacts — ${focusedCampaign.name}`
            : "Distribute contacts"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {focusedCampaign
            ? `Split contacts equally among ${assigneeLabel.toLowerCase()}s or assign manually. Assignment history is preserved on every transfer.`
            : `Choose a campaign to assign contacts to ${assigneeLabel.toLowerCase()}s in your organization.`}
        </p>
      </div>

      {campaignData.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <h3 className="font-heading text-lg font-semibold">
            No campaigns ready for assignment
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Contacts will appear here once they are assigned to you or imported
            into a campaign.
          </p>
        </div>
      ) : (
        <AssignmentsDistributionHub
          actorRole={session.telepastor.role}
          assignees={assignees}
          campaignData={campaignData}
          initialCampaignId={initialCampaignId}
          assigneeLabel={assigneeLabel}
        />
      )}
    </div>
  );
}

export default async function AssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialCampaignId = getParam(resolvedSearchParams, "campaign");

  return (
    <Suspense fallback={<AssignmentsDistributionSkeleton />}>
      <AssignmentsDistributionContent initialCampaignId={initialCampaignId} />
    </Suspense>
  );
}
