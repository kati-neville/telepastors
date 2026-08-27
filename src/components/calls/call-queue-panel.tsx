"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { recordCallAttemptAction } from "@/app/actions/calls";
import { CallHistoryPanel } from "@/components/calls/call-history-panel";
import { CallResponseBadge } from "@/components/calls/call-response-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildTelLink,
  buildWhatsAppLink,
  buildWhatsAppMessage,
  CALL_RESPONSE_SHORT_LABELS,
} from "@/lib/config/calling";
import type {
  AssignedContact,
  CallQueueContact,
  CallQueueStats,
  CallResponse,
  WhatsAppMessageTemplate,
} from "@/types/domain";

const RESPONSE_OPTIONS: CallResponse[] = [
  "COMING",
  "NOT_COMING",
  "UNREACHABLE",
  "WRONG_NUMBER",
  "OTHER",
];

type CallQueuePanelProps = {
  initialContact: CallQueueContact | null;
  allContacts: AssignedContact[];
  stats: CallQueueStats;
  whatsAppTemplates: WhatsAppMessageTemplate[];
  defaultTemplateId: string | null;
};

export function CallQueuePanel({
  initialContact,
  allContacts,
  stats: initialStats,
  whatsAppTemplates,
  defaultTemplateId,
}: CallQueuePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState(initialStats);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    defaultTemplateId ?? whatsAppTemplates[0]?.id ?? "",
  );
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<CallResponse | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSavedContactName, setLastSavedContactName] = useState("");

  const currentContact = initialContact;

  const completedCount = stats.completed;
  const totalCount = stats.assigned;

  const handleSkip = () => {
    if (!currentContact) return;

    const nextSkipped = [...skippedIds, currentContact.id];
    setSkippedIds(nextSkipped);
    const skipSet = new Set(nextSkipped);
    const next = allContacts.find(
      (contact) =>
        !contact.latest_response &&
        !skipSet.has(contact.id) &&
        contact.id !== currentContact.id,
    );

    setSelectedResponse(null);
    setNotes("");

    if (next) {
      router.replace(`/my-calls/queue?contactId=${next.id}`);
    } else {
      router.replace("/my-calls/queue");
    }
  };

  const handleSaveAndNext = () => {
    if (!currentContact) return;

    if (!selectedResponse) {
      toast.error("Select how the call went.");
      return;
    }

    if (selectedResponse === "OTHER" && !notes.trim()) {
      toast.error("Please add notes when selecting Other.");
      return;
    }

    startTransition(async () => {
      const result = await recordCallAttemptAction({
        contactId: currentContact.id,
        response: selectedResponse,
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setLastSavedContactName(currentContact.name);
      setShowSuccess(true);
      setStats(result.data!.stats);

      const nextContactId = result.data?.nextContactId;

      setTimeout(() => {
        setShowSuccess(false);
        setSelectedResponse(null);
        setNotes("");

        if (nextContactId) {
          router.replace(`/my-calls/queue?contactId=${nextContactId}`);
        } else {
          router.replace("/my-calls/queue");
        }

        router.refresh();
      }, 600);
    });
  };

  if (!currentContact) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-2 py-10 text-center">
        <CheckCircle2 className="size-16 text-primary" />
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-semibold">Queue complete</h2>
          <p className="text-sm text-muted-foreground">
            You have worked through all available contacts. {completedCount} of{" "}
            {totalCount} completed.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="min-h-12 flex-1 text-base"
            render={<Link href="/my-calls/list" />}
          >
            View all contacts
          </Button>
          <Button
            variant="outline"
            className="min-h-12 flex-1 text-base"
            render={<Link href="/my-calls" />}
          >
            Back to My Calls
          </Button>
        </div>
      </div>
    );
  }

  const telLink = buildTelLink(currentContact.phone_normalized);
  const selectedTemplate =
    whatsAppTemplates.find((template) => template.id === selectedTemplateId) ??
    whatsAppTemplates.find((template) => template.is_default) ??
    whatsAppTemplates[0];
  const whatsAppLink = buildWhatsAppLink(
    currentContact.phone_normalized,
    buildWhatsAppMessage(
      currentContact.name,
      currentContact.campaign_name,
      selectedTemplate?.body,
    ),
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 pb-28">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="px-0"
          render={<Link href="/my-calls" />}
        >
          <ArrowLeft />
          My Calls
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {completedCount} / {totalCount} completed
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentContact.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">
              {currentContact.campaign_name}
            </p>
            <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
              {currentContact.name}
            </h2>
            <a
              href={telLink}
              className="mt-3 block font-heading text-2xl font-medium text-primary underline-offset-4 hover:underline"
            >
              {currentContact.phone}
            </a>

            {currentContact.latest_response ? (
              <div className="mt-4">
                <CallResponseBadge response={currentContact.latest_response} />
              </div>
            ) : null}

            {currentContact.attempt_count > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {currentContact.attempt_count} previous attempt
                {currentContact.attempt_count === 1 ? "" : "s"} recorded
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              nativeButton={false}
              render={<a href={telLink} />}
              className="min-h-14 text-base"
              size="lg"
            >
              <Phone />
              Call
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={
                <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" />
              }
              className="min-h-14 text-base"
              size="lg"
            >
              WhatsApp
            </Button>
          </div>

          {whatsAppTemplates.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="whatsapp-template">WhatsApp message template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(value) => setSelectedTemplateId(value ?? "")}
              >
                <SelectTrigger id="whatsapp-template" className="w-full">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {whatsAppTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate ? (
                <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {buildWhatsAppMessage(
                    currentContact.name,
                    currentContact.campaign_name,
                    selectedTemplate.body,
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          <CallHistoryPanel attempts={currentContact.prior_attempts} />

          <div className="space-y-3">
            <p className="text-sm font-medium">How did the call go?</p>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSE_OPTIONS.map((response) => (
                <Button
                  key={response}
                  type="button"
                  variant={selectedResponse === response ? "default" : "outline"}
                  className="min-h-12 justify-center text-sm"
                  disabled={isPending}
                  onClick={() => setSelectedResponse(response)}
                >
                  {CALL_RESPONSE_SHORT_LABELS[response]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="call-notes">Notes</Label>
            <Textarea
              id="call-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional details (required for Other)"
              rows={3}
              disabled={isPending}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-lg rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary shadow-lg"
          >
            Saved response for {lastSavedContactName}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 flex-1"
            disabled={isPending}
            onClick={handleSkip}
          >
            <SkipForward />
            Skip
          </Button>
          <Button
            type="button"
            className="min-h-12 flex-[2] text-base"
            disabled={isPending || !selectedResponse}
            onClick={handleSaveAndNext}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Next"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
