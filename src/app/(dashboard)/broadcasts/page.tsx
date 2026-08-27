import Link from "next/link";
import { requireBroadcastsAccess } from "@/app/actions/broadcasts";
import { BroadcastComposer } from "@/components/broadcasts/broadcast-composer";
import { BroadcastHistoryPanel } from "@/components/broadcasts/broadcast-history-panel";
import { Button } from "@/components/ui/button";
import { fetchBroadcastFormOptions } from "@/lib/broadcasts/recipients";
import {
  getConfiguredProviderName,
  isSmsProviderConfigured,
} from "@/lib/sms/get-provider";
import { getSmsProviderStatusMessage } from "@/lib/sms/unconfigured-provider";
import { fetchSmsBroadcasts } from "@/lib/queries/broadcasts";

export default async function BroadcastsPage() {
  await requireBroadcastsAccess();

  const [options, broadcasts, providerConfigured] = await Promise.all([
    fetchBroadcastFormOptions(),
    fetchSmsBroadcasts(),
    Promise.resolve(isSmsProviderConfigured()),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Broadcasts
          </h2>
          <p className="text-sm text-muted-foreground">
            Send SMS broadcasts to campaign contacts and organizations. Preview and
            confirm before any message is sent.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/broadcasts/templates" />}>
          WhatsApp templates
        </Button>
      </div>

      <BroadcastComposer
        options={options}
        providerConfigured={providerConfigured}
        providerName={getConfiguredProviderName()}
        providerStatusMessage={getSmsProviderStatusMessage()}
      />

      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Broadcast history</h3>
          <p className="text-sm text-muted-foreground">
            Past broadcasts with delivery counts and status.
          </p>
        </div>
        <BroadcastHistoryPanel broadcasts={broadcasts} />
      </div>
    </div>
  );
}
