import Link from "next/link";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DistributionCampaignSummary } from "@/lib/queries/assignments";

type DistributionQuickActionProps = {
  totalReady: number;
  campaigns: DistributionCampaignSummary[];
};

export function DistributionQuickAction({
  totalReady,
  campaigns,
}: DistributionQuickActionProps) {
  if (totalReady === 0) {
    return null;
  }

  const primaryCampaign = campaigns.find((campaign) => campaign.readyCount > 0);
  const href = primaryCampaign
    ? `/assignments?campaign=${primaryCampaign.id}`
    : "/assignments";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Contacts ready to distribute</CardTitle>
            <CardDescription>
              {totalReady} contact{totalReady === 1 ? "" : "s"} waiting across{" "}
              {campaigns.filter((campaign) => campaign.readyCount > 0).length}{" "}
              campaign
              {campaigns.filter((campaign) => campaign.readyCount > 0).length === 1
                ? ""
                : "s"}
              .
            </CardDescription>
          </div>
          <Button render={<Link href={href} />}>
            <Share2 />
            Distribute now
          </Button>
        </div>
      </CardHeader>
      {campaigns.filter((campaign) => campaign.readyCount > 0).length > 1 ? (
        <CardContent className="flex flex-wrap gap-2 border-t pt-4">
          {campaigns
            .filter((campaign) => campaign.readyCount > 0)
            .map((campaign) => (
              <Button
                key={campaign.id}
                size="sm"
                variant="outline"
                render={
                  <Link href={`/assignments?campaign=${campaign.id}`} />
                }
              >
                {campaign.name} ({campaign.readyCount})
              </Button>
            ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
