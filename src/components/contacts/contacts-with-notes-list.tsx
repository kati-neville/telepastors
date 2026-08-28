import Link from "next/link";
import { MessageSquareText, Phone } from "lucide-react";
import { CallResponseBadge } from "@/components/calls/call-response-badge";
import { Button } from "@/components/ui/button";
import { buildTelLink } from "@/lib/config/calling";
import type { FollowUpContact } from "@/types/domain";

type ContactsWithNotesListProps = {
  contacts: FollowUpContact[];
  viewerId: string;
  canUseCallQueue: boolean;
};

export function ContactsWithNotesList({
  contacts,
  viewerId,
  canUseCallQueue,
}: ContactsWithNotesListProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-12 text-center">
        <MessageSquareText className="mx-auto size-10 text-muted-foreground/60" />
        <h3 className="mt-3 font-heading text-lg font-semibold">
          No contacts with notes
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Call notes will appear here when callers record details that need
          follow-up.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {contacts.map((contact) => (
          <ContactNoteCard
            key={contact.id}
            contact={contact}
            viewerId={viewerId}
            canUseCallQueue={canUseCallQueue}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Response</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Recorded</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b last:border-b-0">
                <td className="px-3 py-3 align-top">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {contact.phone}
                  </p>
                </td>
                <td className="px-3 py-3 align-top text-muted-foreground">
                  {contact.campaignName}
                </td>
                <td className="px-3 py-3 align-top">
                  {contact.latestResponse ? (
                    <CallResponseBadge response={contact.latestResponse} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-sm px-3 py-3 align-top">
                  <NoteHighlight text={contact.latestNotes} />
                </td>
                <td className="px-3 py-3 align-top text-muted-foreground">
                  {contact.assigneeName}
                </td>
                <td className="px-3 py-3 align-top text-xs text-muted-foreground">
                  <p>{contact.recordedByName}</p>
                  {contact.latestResponseAt ? (
                    <time>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(contact.latestResponseAt))}
                    </time>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <ContactActions
                    contact={contact}
                    viewerId={viewerId}
                    canUseCallQueue={canUseCallQueue}
                    compact
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ContactNoteCard({
  contact,
  viewerId,
  canUseCallQueue,
}: {
  contact: FollowUpContact;
  viewerId: string;
  canUseCallQueue: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{contact.name}</p>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {contact.campaignName} · {contact.assigneeName}
          </p>
        </div>
        {contact.latestResponse ? (
          <CallResponseBadge response={contact.latestResponse} />
        ) : null}
      </div>

      <div className="mt-3">
        <NoteHighlight text={contact.latestNotes} />
      </div>

      <div className="mt-4">
        <ContactActions
          contact={contact}
          viewerId={viewerId}
          canUseCallQueue={canUseCallQueue}
        />
      </div>
    </div>
  );
}

function NoteHighlight({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40">
      <p className="flex items-start gap-2 text-sm font-medium text-amber-950 dark:text-amber-100">
        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{text}</span>
      </p>
    </div>
  );
}

function ContactActions({
  contact,
  viewerId,
  canUseCallQueue,
  compact = false,
}: {
  contact: FollowUpContact;
  viewerId: string;
  canUseCallQueue: boolean;
  compact?: boolean;
}) {
  const telLink = buildTelLink(contact.phoneNormalized);
  const canOpenInQueue =
    canUseCallQueue && contact.currentAssigneeId === viewerId;

  return (
    <div
      className={
        compact
          ? "flex flex-col items-end gap-2"
          : "flex flex-wrap gap-2"
      }
    >
      <Button
        nativeButton={false}
        size={compact ? "sm" : "default"}
        className={compact ? "min-h-9" : "min-h-11 flex-1"}
        render={<a href={telLink} />}
      >
        <Phone />
        Call
      </Button>
      {canOpenInQueue ? (
        <Button
          nativeButton={false}
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "min-h-9" : "min-h-11 flex-1"}
          render={
            <Link href={`/my-calls/queue?contactId=${contact.id}`} />
          }
        >
          Open in queue
        </Button>
      ) : null}
    </div>
  );
}
