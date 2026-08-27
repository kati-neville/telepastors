"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AssignedContactsList } from "@/components/calls/assigned-contacts-list";
import { Button } from "@/components/ui/button";
import type { AssignedContact } from "@/types/domain";

export function AssignedContactsPageClient({
  contacts,
}: {
  contacts: AssignedContact[];
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        render={<Link href="/my-calls" />}
      >
        <ChevronLeft />
        My Calls
      </Button>

      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          My Contacts
        </h2>
        <p className="text-sm text-muted-foreground">
          Secondary list view. Use the call queue for fastest workflow.
        </p>
      </div>

      <AssignedContactsList
        contacts={contacts}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}
