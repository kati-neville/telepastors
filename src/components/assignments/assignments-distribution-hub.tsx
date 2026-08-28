"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { DistributionPanel } from "@/components/assignments/distribution-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  Campaign,
  ContactWithAssignee,
  DistributionStats,
  MinistryRole,
  TelepastorSummary,
} from "@/types/domain";

export type CampaignDistributionData = {
  campaign: Campaign;
  stats: DistributionStats;
  contacts: ContactWithAssignee[];
};

type AssignmentsDistributionHubProps = {
  actorRole: MinistryRole;
  assignees: TelepastorSummary[];
  campaignData: CampaignDistributionData[];
  initialCampaignId?: string;
  assigneeLabel: string;
};

function getDefaultExpandedCampaignId(
  campaignData: CampaignDistributionData[],
  initialCampaignId?: string,
): string | null {
  if (campaignData.length === 0) {
    return null;
  }

  if (campaignData.length === 1) {
    return campaignData[0]!.campaign.id;
  }

  if (initialCampaignId) {
    const matched = campaignData.find(
      (entry) => entry.campaign.id === initialCampaignId,
    );
    if (matched) {
      return matched.campaign.id;
    }
  }

  const readyCampaign = campaignData.find(
    (entry) => entry.stats.assignedToMe > 0,
  );

  return readyCampaign?.campaign.id ?? null;
}

export function AssignmentsDistributionHub({
  actorRole,
  assignees,
  campaignData,
  initialCampaignId,
  assigneeLabel,
}: AssignmentsDistributionHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const singleCampaign = campaignData.length === 1;

  const defaultExpandedId = useMemo(
    () => getDefaultExpandedCampaignId(campaignData, initialCampaignId),
    [campaignData, initialCampaignId],
  );

  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    defaultExpandedId,
  );

  const updateCampaignParam = (campaignId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (campaignId) {
      params.set("campaign", campaignId);
    } else {
      params.delete("campaign");
    }

    router.replace(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  };

  const toggleCampaign = (campaignId: string) => {
    if (singleCampaign) {
      return;
    }

    setExpandedCampaignId((current) => {
      const next = current === campaignId ? null : campaignId;
      updateCampaignParam(next);
      return next;
    });
  };

  return (
    <div className="grid gap-4">
      {campaignData.map(({ campaign, stats, contacts }) => {
        const isExpanded = singleCampaign || expandedCampaignId === campaign.id;

        return (
          <Card
            key={campaign.id}
            className={cn(
              stats.assignedToMe > 0 && "border-primary/30",
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <CampaignStatusBadge status={campaign.status} />
                    {stats.assignedToMe > 0 ? (
                      <Badge variant="secondary">
                        {stats.assignedToMe} ready
                      </Badge>
                    ) : null}
                  </div>
                  {campaign.description ? (
                    <CardDescription>{campaign.description}</CardDescription>
                  ) : (
                    <CardDescription>
                      Assign contacts to {assigneeLabel.toLowerCase()}s in this
                      campaign.
                    </CardDescription>
                  )}
                </div>

                {!singleCampaign ? (
                  <Button
                    type="button"
                    variant={isExpanded ? "secondary" : "outline"}
                    onClick={() => toggleCampaign(campaign.id)}
                  >
                    {isExpanded ? "Hide distribution" : "Distribute"}
                    <ChevronDown
                      className={cn(
                        "transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </Button>
                ) : null}
              </div>
            </CardHeader>

            {isExpanded ? (
              <CardContent className="space-y-4 border-t pt-6">
                <DistributionPanel
                  embedded
                  campaignId={campaign.id}
                  campaignName={campaign.name}
                  actorRole={actorRole}
                  stats={stats}
                  contacts={contacts}
                  assignees={assignees}
                />
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
