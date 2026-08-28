"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  confirmBroadcastAction,
  fetchCampaignContactsAction,
  previewBroadcastAction,
} from "@/app/actions/broadcasts";
import { BroadcastStatusBadge } from "@/components/broadcasts/broadcast-status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BROADCAST_SCOPE_DESCRIPTIONS } from "@/lib/broadcasts/labels";

type BroadcastFormOptions = {
  campaigns: { id: string; name: string; status: string }[];
  governors: { id: string; name: string }[];
  leaders: { id: string; name: string }[];
  telepastors: { id: string; name: string }[];
};

type ContactOption = {
  id: string;
  name: string;
  phone: string;
};

import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { BroadcastRecipientScope, BroadcastPreview } from "@/types/domain";
import type { BroadcastComposerValues } from "@/lib/validations/broadcasts";
import { BROADCAST_RECIPIENT_SCOPES } from "@/types/domain";

const ALL_CAMPAIGNS = "__all__";
const ALL_MEMBERS = "__all__";

function scopeNeedsCampaign(scope: BroadcastRecipientScope) {
  return (
    scope === "CAMPAIGN" ||
    scope === "SELECTED_CONTACTS" ||
    scope === "RESPONSE_TYPE"
  );
}

function scopeOptionalCampaign(scope: BroadcastRecipientScope) {
  return (
    scope === "ALL_CONTACTS" ||
    scope === "GOVERNOR_ORG" ||
    scope === "LEADER_ORG" ||
    scope === "TELEPASTOR_ASSIGNMENTS"
  );
}

type BroadcastComposerProps = {
  options: BroadcastFormOptions;
  providerConfigured: boolean;
  providerName: string | null;
  providerStatusMessage: string;
};

export function BroadcastComposer({
  options,
  providerConfigured,
  providerName,
  providerStatusMessage,
}: BroadcastComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<BroadcastRecipientScope>("ALL_CONTACTS");
  const [message, setMessage] = useState("");
  const [campaignId, setCampaignId] = useState(ALL_CAMPAIGNS);
  const [governorId, setGovernorId] = useState(ALL_MEMBERS);
  const [leaderId, setLeaderId] = useState(ALL_MEMBERS);
  const [telepastorId, setTelepastorId] = useState(ALL_MEMBERS);
  const [response, setResponse] = useState<string>("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    new Set(),
  );
  const [campaignContacts, setCampaignContacts] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<BroadcastComposerValues | null>(
    null,
  );

  const needsCampaign = useMemo(() => scopeNeedsCampaign(scope), [scope]);
  const optionalCampaign = useMemo(() => scopeOptionalCampaign(scope), [scope]);

  const scopeItems = useMemo(
    () =>
      BROADCAST_RECIPIENT_SCOPES.map((item) => ({
        value: item,
        label: BROADCAST_SCOPE_DESCRIPTIONS[item],
      })),
    [],
  );

  const campaignItems = useMemo(() => {
    const items = options.campaigns.map((campaign) => ({
      value: campaign.id,
      label: campaign.name,
    }));

    if (optionalCampaign) {
      return [{ value: ALL_CAMPAIGNS, label: "All campaigns" }, ...items];
    }

    return items;
  }, [optionalCampaign, options.campaigns]);

  const governorItems = useMemo(
    () => [
      { value: ALL_MEMBERS, label: "All governors" },
      ...options.governors.map((governor) => ({
        value: governor.id,
        label: governor.name,
      })),
    ],
    [options.governors],
  );

  const leaderItems = useMemo(
    () => [
      { value: ALL_MEMBERS, label: "All leaders" },
      ...options.leaders.map((leader) => ({
        value: leader.id,
        label: leader.name,
      })),
    ],
    [options.leaders],
  );

  const telepastorItems = useMemo(
    () => [
      { value: ALL_MEMBERS, label: "All telepastors" },
      ...options.telepastors.map((telepastor) => ({
        value: telepastor.id,
        label: telepastor.name,
      })),
    ],
    [options.telepastors],
  );

  const responseItems = useMemo(
    () =>
      Object.entries(CALL_RESPONSE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const resolvedCampaignId =
    optionalCampaign && !campaignId ? ALL_CAMPAIGNS : campaignId;

  const loadCampaignContacts = (nextCampaignId: string) => {
    if (!nextCampaignId) {
      setCampaignContacts([]);
      setSelectedContactIds(new Set());
      return;
    }

    setLoadingContacts(true);
    fetchCampaignContactsAction(nextCampaignId)
      .then((result) => {
        if (result.success && result.data) {
          setCampaignContacts(result.data);
          setSelectedContactIds(new Set());
        } else if (!result.success) {
          setCampaignContacts([]);
          setSelectedContactIds(new Set());
          toast.error(result.error ?? "Failed to load contacts.");
        }
      })
      .finally(() => {
        setLoadingContacts(false);
      });
  };

  const handleScopeChange = (nextScope: BroadcastRecipientScope) => {
    setScope(nextScope);
    setGovernorId(ALL_MEMBERS);
    setLeaderId(ALL_MEMBERS);
    setTelepastorId(ALL_MEMBERS);

    if (scopeOptionalCampaign(nextScope)) {
      setCampaignId((current) =>
        current && current !== ALL_CAMPAIGNS ? current : ALL_CAMPAIGNS,
      );
    } else if (campaignId === ALL_CAMPAIGNS) {
      setCampaignId("");
    }

    if (nextScope !== "SELECTED_CONTACTS") {
      setCampaignContacts([]);
      setSelectedContactIds(new Set());
    } else if (campaignId && campaignId !== ALL_CAMPAIGNS) {
      loadCampaignContacts(campaignId);
    }
  };

  const handleCampaignChange = (nextCampaignId: string) => {
    setCampaignId(nextCampaignId);
    if (scope === "SELECTED_CONTACTS" && nextCampaignId) {
      loadCampaignContacts(nextCampaignId);
    }
  };

  const buildValues = (): BroadcastComposerValues => ({
    message: message.trim(),
    scope,
    campaignId:
      resolvedCampaignId && resolvedCampaignId !== ALL_CAMPAIGNS
        ? resolvedCampaignId
        : undefined,
    governorId:
      governorId && governorId !== ALL_MEMBERS ? governorId : undefined,
    leaderId: leaderId && leaderId !== ALL_MEMBERS ? leaderId : undefined,
    telepastorId:
      telepastorId && telepastorId !== ALL_MEMBERS ? telepastorId : undefined,
    response: response
      ? (response as BroadcastComposerValues["response"])
      : undefined,
    contactIds:
      scope === "SELECTED_CONTACTS" ? [...selectedContactIds] : undefined,
  });

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handlePreview = () => {
    const values = buildValues();

    startTransition(async () => {
      const result = await previewBroadcastAction(values);
      if (!result.success) {
        toast.error(result.error ?? "Unable to preview broadcast.");
        return;
      }
      if (!result.data) {
        toast.error("Unable to preview broadcast.");
        return;
      }

      setPendingValues(values);
      setPreview(result.data);
      setConfirmOpen(true);
    });
  };

  const handleConfirmSend = () => {
    if (!pendingValues) return;

    startTransition(async () => {
      const result = await confirmBroadcastAction(pendingValues);
      setConfirmOpen(false);
      setPreview(null);
      setPendingValues(null);

      if (!result.success) {
        toast.error(result.error ?? "Broadcast failed.");
        return;
      }

      if (result.data?.status === "UNAVAILABLE") {
        toast.warning(
          "Broadcast recorded but SMS was not sent. Configure an SMS provider to enable delivery.",
        );
      } else {
        toast.success("Broadcast sent.");
      }

      setMessage("");
      setSelectedContactIds(new Set());
      router.refresh();
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>New SMS broadcast</CardTitle>
          <CardDescription>
            Choose recipients, compose your message, preview, then confirm before
            sending. Use {"{name}"} and {"{campaign}"} for personalization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!providerConfigured ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  SMS provider not configured
                </p>
                <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                  {providerStatusMessage} You can still compose and preview
                  broadcasts; confirmed sends will be recorded as unavailable.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Provider: <span className="font-medium">{providerName}</span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="broadcast-scope">Recipient group</Label>
              <Select
                value={scope}
                items={scopeItems}
                onValueChange={(value) => {
                  if (value) handleScopeChange(value as BroadcastRecipientScope);
                }}
              >
                <SelectTrigger id="broadcast-scope" className="w-full">
                  <SelectValue placeholder="Select recipient group" />
                </SelectTrigger>
                <SelectContent>
                  {scopeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scope === "ALL_CONTACTS" ? (
                <p className="text-xs text-muted-foreground">
                  Sends to every contact in the system.
                </p>
              ) : scope === "GOVERNOR_ORG" ||
                scope === "LEADER_ORG" ||
                scope === "TELEPASTOR_ASSIGNMENTS" ? (
                <p className="text-xs text-muted-foreground">
                  Defaults to the whole group. Narrow to one person only if you
                  need a subset.
                </p>
              ) : null}
            </div>

            {(needsCampaign || optionalCampaign) && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-campaign">
                  Campaign{needsCampaign ? "" : " (optional filter)"}
                </Label>
                <Select
                  value={resolvedCampaignId}
                  items={campaignItems}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (optionalCampaign && value === ALL_CAMPAIGNS) {
                      setCampaignId(ALL_CAMPAIGNS);
                      return;
                    }
                    handleCampaignChange(value);
                  }}
                >
                  <SelectTrigger id="broadcast-campaign" className="w-full">
                    <SelectValue
                      placeholder={
                        optionalCampaign ? "All campaigns" : "Select campaign"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {optionalCampaign ? (
                      <SelectItem value={ALL_CAMPAIGNS}>All campaigns</SelectItem>
                    ) : null}
                    {options.campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "GOVERNOR_ORG" && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-governor">Governor (optional)</Label>
                <Select
                  value={governorId || ALL_MEMBERS}
                  items={governorItems}
                  onValueChange={(value) => setGovernorId(value ?? ALL_MEMBERS)}
                >
                  <SelectTrigger id="broadcast-governor" className="w-full">
                    <SelectValue placeholder="All governors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_MEMBERS}>All governors</SelectItem>
                    {options.governors.map((governor) => (
                      <SelectItem key={governor.id} value={governor.id}>
                        {governor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "LEADER_ORG" && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-leader">Leader (optional)</Label>
                <Select
                  value={leaderId || ALL_MEMBERS}
                  items={leaderItems}
                  onValueChange={(value) => setLeaderId(value ?? ALL_MEMBERS)}
                >
                  <SelectTrigger id="broadcast-leader" className="w-full">
                    <SelectValue placeholder="All leaders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_MEMBERS}>All leaders</SelectItem>
                    {options.leaders.map((leader) => (
                      <SelectItem key={leader.id} value={leader.id}>
                        {leader.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "TELEPASTOR_ASSIGNMENTS" && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-telepastor">Telepastor (optional)</Label>
                <Select
                  value={telepastorId || ALL_MEMBERS}
                  items={telepastorItems}
                  onValueChange={(value) =>
                    setTelepastorId(value ?? ALL_MEMBERS)
                  }
                >
                  <SelectTrigger id="broadcast-telepastor" className="w-full">
                    <SelectValue placeholder="All telepastors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_MEMBERS}>All telepastors</SelectItem>
                    {options.telepastors.map((telepastor) => (
                      <SelectItem key={telepastor.id} value={telepastor.id}>
                        {telepastor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "RESPONSE_TYPE" && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-response">Response type</Label>
                <Select
                  value={response}
                  items={responseItems}
                  onValueChange={(value) => setResponse(value ?? "")}
                >
                  <SelectTrigger id="broadcast-response" className="w-full">
                    <SelectValue placeholder="Select response" />
                  </SelectTrigger>
                  <SelectContent>
                    {responseItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {scope === "SELECTED_CONTACTS" &&
          resolvedCampaignId &&
          resolvedCampaignId !== ALL_CAMPAIGNS ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Contacts</Label>
                <p className="text-xs text-muted-foreground">
                  {selectedContactIds.size} selected
                </p>
              </div>
              {loadingContacts ? (
                <p className="text-sm text-muted-foreground">Loading contacts...</p>
              ) : campaignContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts found for this campaign.
                </p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {campaignContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.has(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                        className="size-4 rounded border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {contact.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {contact.phone}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hello {name}, reminder about {campaign}..."
              rows={5}
              maxLength={1600}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1600 characters
            </p>
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isPending || !message.trim()}
            onClick={handlePreview}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Preparing preview...
              </>
            ) : (
              <>
                <Send />
                Preview broadcast
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-[calc(100vw-1.5rem)] max-h-[90vh] gap-5 overflow-y-auto sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm SMS broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              Review the details below. Messages are only sent after you confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {preview ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Recipients</p>
                  <p className="text-lg font-semibold">{preview.recipientCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estimated SMS units</p>
                  <p className="text-lg font-semibold">
                    {preview.estimatedSmsUnits}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
                  {pendingValues?.message}
                </p>
              </div>

              <div>
                <p className="mb-1 text-muted-foreground">
                  Preview
                  {preview.sampleRecipientName
                    ? ` (${preview.sampleRecipientName})`
                    : ""}
                </p>
                <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3">
                  {preview.messagePreview}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Provider:</span>
                {preview.providerConfigured ? (
                  <span className="font-medium">{preview.providerName}</span>
                ) : (
                  <BroadcastStatusBadge status="UNAVAILABLE" />
                )}
              </div>

              {!preview.providerConfigured ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                  {providerStatusMessage} This broadcast will be saved but not
                  delivered.
                </p>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !pendingValues}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmSend();
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending...
                </>
              ) : preview?.providerConfigured ? (
                "Confirm and send"
              ) : (
                "Confirm (record only)"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
