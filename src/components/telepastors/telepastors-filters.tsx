"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";

type TelepastorsFiltersProps = {
  viewerRole: MinistryRole;
  governors: TelepastorSummary[];
  leaders: TelepastorSummary[];
};

export function TelepastorsFilters({
  viewerRole,
  governors,
  leaders,
}: TelepastorsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("q") ?? "";
  const currentRole = searchParams.get("role") ?? "ALL";
  const currentGovernor = searchParams.get("governor") ?? "ALL";
  const currentLeader = searchParams.get("leader") ?? "ALL";
  const currentStatus = searchParams.get("status") ?? "all";

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "ALL" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  };

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-2 md:col-span-2 xl:col-span-2">
        <Label htmlFor="telepastors-search">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="telepastors-search"
            defaultValue={currentQuery}
            placeholder="Search by name or phone"
            className="pl-8"
            onChange={(event) => updateParams("q", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Select
          value={currentRole}
          onValueChange={(value) => updateParams("role", value ?? "ALL")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="GOVERNOR">Governors</SelectItem>
            <SelectItem value="LEADER">Leaders</SelectItem>
            <SelectItem value="TELEPASTOR">Telepastors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewerRole === "SUPER_ADMIN" ? (
        <div className="space-y-2">
          <Label>Governor</Label>
          <Select
            value={currentGovernor}
            onValueChange={(value) => updateParams("governor", value ?? "ALL")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All governors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All governors</SelectItem>
              {governors.map((governor) => (
                <SelectItem key={governor.id} value={governor.id}>
                  {governor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {viewerRole === "SUPER_ADMIN" || viewerRole === "GOVERNOR" ? (
        <div className="space-y-2">
          <Label>Leader</Label>
          <Select
            value={currentLeader}
            onValueChange={(value) => updateParams("leader", value ?? "ALL")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All leaders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All leaders</SelectItem>
              {leaders.map((leader) => (
                <SelectItem key={leader.id} value={leader.id}>
                  {leader.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={currentStatus}
          onValueChange={(value) => updateParams("status", value ?? "all")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function TelepastorsEmptyState({
  canCreate,
}: {
  canCreate: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <h3 className="font-heading text-lg font-semibold">No Telepastors found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Try adjusting your search or filters.
      </p>
      {canCreate ? (
        <Link
          href="/telepastors/new"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Add the first Telepastor
        </Link>
      ) : null}
    </div>
  );
}
