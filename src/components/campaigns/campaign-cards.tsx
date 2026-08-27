import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { formatCampaignDate } from "@/lib/campaigns/format";
import type { Campaign } from "@/types/domain";

type CampaignListItem = Campaign & { contact_count: number };

export function CampaignCards({ campaigns }: { campaigns: CampaignListItem[] }) {
  return (
    <div className="grid gap-3 md:hidden">
      {campaigns.map((campaign) => (
        <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
          <Card className="transition-colors hover:bg-muted/30">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  {campaign.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CampaignStatusBadge status={campaign.status} />
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="size-3.5" />
                  {campaign.contact_count}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Event: {formatCampaignDate(campaign.event_date)}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
