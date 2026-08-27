import Link from "next/link";
import { Share2 } from "lucide-react";
import { requireAssignmentsAccess } from "@/app/actions/assignments";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import { fetchCampaignsForDistribution } from "@/lib/queries/assignments";

export default async function AssignmentsPage() {
  const { session, context } = await requireAssignmentsAccess();
  const campaigns = await fetchCampaignsForDistribution(context);
  const assigneeLabel = getAssigneeLabel(session.telepastor.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Assignments
        </h2>
        <p className="text-sm text-muted-foreground">
          Distribute campaign contacts to {assigneeLabel.toLowerCase()}s in your
          organization.
        </p>
      </div>

      {campaigns.length === 0 ? (
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
        <div className="grid gap-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <CampaignStatusBadge status={campaign.status} />
                    {campaign.description ? (
                      <CardDescription>{campaign.description}</CardDescription>
                    ) : null}
                  </div>
                  <Button
                    render={
                      <Link href={`/campaigns/${campaign.id}/distribute`} />
                    }
                  >
                    <Share2 />
                    Distribute
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Open this campaign to assign contacts to{" "}
                  {assigneeLabel.toLowerCase()}s.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
