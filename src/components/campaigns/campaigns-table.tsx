import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { formatCampaignDate } from "@/lib/campaigns/format";
import type { Campaign } from "@/types/domain";

type CampaignListItem = Campaign & { contact_count: number };

export function CampaignsTable({
  campaigns,
}: {
  campaigns: CampaignListItem[];
}) {
  return (
    <div className="hidden rounded-xl border bg-card shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Event date</TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="font-medium hover:underline"
                >
                  {campaign.name}
                </Link>
                {campaign.description ? (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {campaign.description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <CampaignStatusBadge status={campaign.status} />
              </TableCell>
              <TableCell>{formatCampaignDate(campaign.event_date)}</TableCell>
              <TableCell>{campaign.contact_count}</TableCell>
              <TableCell>{formatCampaignDate(campaign.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CampaignsEmptyState({
  canCreate,
}: {
  canCreate: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <h3 className="font-heading text-lg font-semibold">No campaigns yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a campaign to start importing contacts for a calling exercise.
      </p>
      {canCreate ? (
        <Link
          href="/campaigns/new"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Create your first campaign
        </Link>
      ) : null}
    </div>
  );
}
