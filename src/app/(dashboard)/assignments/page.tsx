import { Suspense } from "react";
import { requireAssignmentsAccess } from "@/app/actions/assignments";
import { AssignmentsDistributionHub } from "@/components/assignments/assignments-distribution-hub";
import type { CampaignDistributionData } from "@/components/assignments/assignments-distribution-hub";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import {
  fetchAssignableMembers,
  fetchCampaignsForDistribution,
  fetchDistributionStats,
} from "@/lib/queries/assignments";
import { Skeleton } from "@/components/ui/skeleton";
import type { Campaign, DistributionStats } from "@/types/domain";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATS_CONCURRENCY = 3;

const EMPTY_STATS: DistributionStats = {
  total: 0,
  assigned: 0,
  unassigned: 0,
  assignedToMe: 0,
  heldForOwnCalls: 0,
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

async function loadCampaignDistributionData(
  campaigns: Campaign[],
  context: AuthorizationContext,
): Promise<CampaignDistributionData[]> {
  const results: CampaignDistributionData[] = [];

  for (let index = 0; index < campaigns.length; index += STATS_CONCURRENCY) {
    const batch = campaigns.slice(index, index + STATS_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (campaign) => {
        try {
          const stats = await fetchDistributionStats(campaign.id, context);
          return { campaign, stats } satisfies CampaignDistributionData;
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim()
              ? error.message
              : "Failed to load assignment stats.";

          return {
            campaign,
            stats: EMPTY_STATS,
            statsError: message,
          } satisfies CampaignDistributionData;
        }
      }),
    );

    results.push(...batchResults);
  }

  return results;
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

  // Stats-only hub load — contacts are fetched when a campaign is opened for
  // manual assignment (avoids N× full contact pagination timeouts).
  const campaignData = await loadCampaignDistributionData(campaigns, context);

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
