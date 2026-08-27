import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FileSpreadsheet, Pencil, Share2 } from "lucide-react";
import { requireCampaignAccess } from "@/app/actions/campaigns";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { ContactCards } from "@/components/campaigns/contact-cards";
import { ContactsSearch } from "@/components/campaigns/contacts-search";
import {
  ContactsEmptyState,
  ContactsTable,
} from "@/components/campaigns/contacts-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stats/stat-card";
import { formatCampaignDate } from "@/lib/campaigns/format";
import { canDistributeContacts } from "@/lib/auth/assignments";
import {
  canEditCampaign,
  canImportCampaignContacts,
} from "@/lib/auth/permissions";
import { fetchDistributionStats } from "@/lib/queries/assignments";
import {
  fetchCampaignContacts,
  fetchContactImports,
} from "@/lib/queries/contacts";
import { contactsFilterSchema } from "@/lib/validations/campaigns";

type CampaignDetailPageProps = {
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

async function CampaignContactsSection({
  campaignId,
  searchParams,
}: {
  campaignId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = contactsFilterSchema.parse({
    q: getParam(searchParams, "q"),
  });

  const contacts = await fetchCampaignContacts(campaignId, filters);

  return (
    <div className="space-y-4">
      <ContactsSearch campaignId={campaignId} />
      {contacts.length === 0 ? (
        <ContactsEmptyState />
      ) : (
        <>
          <ContactsTable contacts={contacts} />
          <ContactCards contacts={contacts} />
        </>
      )}
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: CampaignDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { session, campaign } = await requireCampaignAccess(id);
  const context = { telepastor: session.telepastor };
  const imports = await fetchContactImports(id);
  const assignmentStats = await fetchDistributionStats(id, context);
  const canEdit = canEditCampaign(context);
  const canImport = canImportCampaignContacts(context);
  const canDistribute = canDistributeContacts(context);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button variant="ghost" className="px-0" render={<Link href="/campaigns" />}>
        <ChevronLeft />
        Back to campaigns
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h2>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description ? (
            <p className="max-w-3xl text-muted-foreground">
              {campaign.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canDistribute ? (
            <Button
              render={<Link href={`/campaigns/${campaign.id}/distribute`} />}
            >
              <Share2 />
              Distribute
            </Button>
          ) : null}
          {canImport ? (
            <Button render={<Link href={`/campaigns/${campaign.id}/import`} />}>
              <FileSpreadsheet />
              Import contacts
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="outline"
              render={<Link href={`/campaigns/${campaign.id}/edit`} />}
            >
              <Pencil />
              Edit campaign
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total contacts" value={campaign.contact_count} />
        <StatCard label="Assigned" value={assignmentStats.assigned} />
        <StatCard label="Unassigned" value={assignmentStats.unassigned} />
        <StatCard label="Completed imports" value={campaign.import_count} />
        <StatCard
          label="Event date"
          value={formatCampaignDate(campaign.event_date)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import history</CardTitle>
          <CardDescription>
            Previous Excel imports for this campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No imports yet. Super Admins can upload an Excel file to add
              contacts.
            </p>
          ) : (
            <div className="space-y-3">
              {imports.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.imported_by_name ?? "Unknown"} ·{" "}
                      {formatCampaignDate(item.created_at)}
                    </p>
                  </div>
                  <p className="text-sm">
                    {item.imported_rows} imported · {item.invalid_rows} invalid
                    · {item.duplicate_rows} duplicates
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
          <CardDescription>
            People to be called for this campaign. Contacts are separate from
            Telepastors ministry members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
            <CampaignContactsSection
              campaignId={campaign.id}
              searchParams={resolvedSearchParams}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
