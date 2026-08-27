import Link from "next/link";
import { BroadcastStatusBadge } from "@/components/broadcasts/broadcast-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BROADCAST_SCOPE_LABELS } from "@/lib/broadcasts/labels";
import type { SmsBroadcastSummary } from "@/types/domain";

const SCOPE_LABELS = BROADCAST_SCOPE_LABELS;

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type BroadcastHistoryPanelProps = {
  broadcasts: SmsBroadcastSummary[];
};

export function BroadcastHistoryPanel({ broadcasts }: BroadcastHistoryPanelProps) {
  if (broadcasts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center">
        <h3 className="font-heading text-lg font-semibold">No broadcasts yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sent SMS broadcasts will appear here with delivery status.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sent</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((broadcast) => (
            <TableRow key={broadcast.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatTimestamp(broadcast.confirmed_at ?? broadcast.created_at)}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {SCOPE_LABELS[broadcast.recipient_scope]}
                  </p>
                  {broadcast.campaign_name ? (
                    <p className="text-xs text-muted-foreground">
                      {broadcast.campaign_name}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{broadcast.recipient_count}</TableCell>
              <TableCell>
                <BroadcastStatusBadge status={broadcast.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {broadcast.status === "UNAVAILABLE" ? (
                  "Not sent"
                ) : (
                  <>
                    {broadcast.delivered_count} delivered · {broadcast.failed_count}{" "}
                    failed · {broadcast.pending_count} pending
                  </>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/broadcasts/${broadcast.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
