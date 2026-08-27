"use client";

import Link from "next/link";
import { Phone, Search } from "lucide-react";
import { CallResponseBadge } from "@/components/calls/call-response-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildTelLink } from "@/lib/config/calling";
import type { AssignedContact } from "@/types/domain";

type AssignedContactsListProps = {
  contacts: AssignedContact[];
  search: string;
  onSearchChange: (value: string) => void;
};

export function AssignedContactsList({
  contacts,
  search,
  onSearchChange,
}: AssignedContactsListProps) {
  const query = search.trim().toLowerCase();
  const filtered = query
    ? contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.phone.toLowerCase().includes(query),
      )
    : contacts;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="assigned-contacts-search">Search contacts</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="assigned-contacts-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name or phone"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          No assigned contacts match your search.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>

          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.campaign_name}</TableCell>
                    <TableCell>
                      {contact.latest_response ? (
                        <CallResponseBadge response={contact.latest_response} />
                      ) : (
                        "Pending"
                      )}
                    </TableCell>
                    <TableCell>{contact.attempt_count}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/my-calls/queue?contactId=${contact.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open in queue
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: AssignedContact }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{contact.name}</p>
          <a
            href={buildTelLink(contact.phone_normalized)}
            className="mt-1 block text-lg font-medium text-primary"
          >
            {contact.phone}
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            {contact.campaign_name}
          </p>
        </div>
        {contact.latest_response ? (
          <CallResponseBadge response={contact.latest_response} />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {contact.attempt_count} attempt
          {contact.attempt_count === 1 ? "" : "s"}
        </p>
        <Link
          href={`/my-calls/queue?contactId=${contact.id}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Phone className="size-4" />
          Call
        </Link>
      </div>
    </div>
  );
}
