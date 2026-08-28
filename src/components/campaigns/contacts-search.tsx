"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContactsSearch({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";

  const updateQuery = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value) {
      params.delete("q");
    } else {
      params.set("q", value);
    }

    params.delete("page");

    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`contacts-search-${campaignId}`}>Search contacts</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`contacts-search-${campaignId}`}
          defaultValue={currentQuery}
          placeholder="Search by name or phone"
          className="pl-8"
          onChange={(event) => updateQuery(event.target.value)}
        />
      </div>
    </div>
  );
}
