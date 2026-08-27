import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroadcastsAccess } from "@/app/actions/broadcasts";
import { BroadcastStatusBadge } from "@/components/broadcasts/broadcast-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BROADCAST_SCOPE_LABELS } from "@/lib/broadcasts/labels";
import { fetchSmsBroadcastById } from "@/lib/queries/broadcasts";
import type { SmsRecipientStatus } from "@/types/domain";

const SCOPE_LABELS = BROADCAST_SCOPE_LABELS;

const RECIPIENT_STATUS_LABELS: Record<SmsRecipientStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type BroadcastDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BroadcastDetailPage({
  params,
}: BroadcastDetailPageProps) {
  await requireBroadcastsAccess();
  const { id } = await params;
  const broadcast = await fetchSmsBroadcastById(id);

  if (!broadcast) {
    notFound();
  }

  const skippedCount = broadcast.recipients.filter(
    (recipient) => recipient.status === "SKIPPED",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 px-0"
            render={<Link href="/broadcasts" />}
          >
            Back to broadcasts
          </Button>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Broadcast details
          </h2>
          <p className="text-sm text-muted-foreground">
            Sent {formatTimestamp(broadcast.confirmed_at ?? broadcast.created_at)}
            {broadcast.created_by_name ? ` by ${broadcast.created_by_name}` : ""}
          </p>
        </div>
        <BroadcastStatusBadge status={broadcast.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recipients</CardDescription>
            <CardTitle className="text-2xl">{broadcast.recipient_count}</CardTitle>
          </CardHeader>
        </Card>
        {broadcast.status === "UNAVAILABLE" ? (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Skipped (not sent)</CardDescription>
              <CardTitle className="text-2xl">{skippedCount}</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Delivered</CardDescription>
                <CardTitle className="text-2xl">{broadcast.delivered_count}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-2xl">{broadcast.failed_count}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-2xl">{broadcast.pending_count}</CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message & context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Audience</p>
            <p className="font-medium">
              {SCOPE_LABELS[broadcast.recipient_scope]}
              {broadcast.campaign_name ? ` · ${broadcast.campaign_name}` : ""}
            </p>
            {broadcast.scope_context_label ? (
              <p className="mt-1 text-muted-foreground">
                {broadcast.scope_context_label}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Message</p>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
              {broadcast.message}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Provider</p>
              <p>{broadcast.provider ?? "Not configured"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Estimated SMS units</p>
              <p>{broadcast.estimated_sms_units ?? "—"}</p>
            </div>
          </div>
          {broadcast.error_message ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              {broadcast.error_message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Recipients</h3>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcast.recipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell>{recipient.contact_name ?? "—"}</TableCell>
                  <TableCell>{recipient.phone_normalized}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {RECIPIENT_STATUS_LABELS[recipient.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {recipient.error_message ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
