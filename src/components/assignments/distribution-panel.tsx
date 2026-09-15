"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { assignContactsAction } from "@/app/actions/assignments";
import { AssignmentStatusBadge } from "@/components/assignments/assignment-status-badge";
import {
  DistributionModeTabs,
  type DistributionMode,
} from "@/components/assignments/distribution-mode-tabs";
import { DistributionPoolFilter } from "@/components/assignments/distribution-pool-filter";
import { EqualSplitPanel } from "@/components/assignments/equal-split-panel";
import { NoAssigneesDistributionEmpty } from "@/components/assignments/no-assignees-distribution-empty";
import { StatCard } from "@/components/stats/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAssigneeLabel } from "@/lib/auth/assignments";
import { getRoleLabel } from "@/lib/auth/roles";
import type {
  ContactWithAssignee,
  DistributionStats,
  MinistryRole,
  TelepastorSummary,
} from "@/types/domain";
import type { DistributionFilterValues } from "@/lib/validations/assignments";

type DistributionPanelProps = {
  campaignId: string;
  campaignName: string;
  actorRole: MinistryRole;
  stats: DistributionStats;
  contacts: ContactWithAssignee[];
  assignees: TelepastorSummary[];
  initialSearch?: string;
  initialPool?: DistributionFilterValues["pool"];
  embedded?: boolean;
};

export function DistributionPanel({
  campaignId,
  campaignName,
  actorRole,
  stats,
  contacts,
  assignees,
  initialSearch = "",
  initialPool = "all",
  embedded = false,
}: DistributionPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DistributionMode>("equal");
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const assigneeLabel = getAssigneeLabel(actorRole);
  const assigneeItems = useMemo(
    () =>
      assignees.map((assignee) => ({
        label: assignee.name,
        value: assignee.id,
      })),
    [assignees],
  );

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.phone.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  const allVisibleSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedIds.has(contact.id));

  const toggleContact = (contactId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(filteredContacts.map((contact) => contact.id)));
  };

  const handleAssign = () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one contact.");
      return;
    }

    if (!assigneeId) {
      toast.error(`Select a ${assigneeLabel.toLowerCase()}.`);
      return;
    }

    startTransition(async () => {
      const result = await assignContactsAction({
        campaignId,
        contactIds: [...selectedIds],
        assigneeId,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `${result.data?.assignedCount ?? selectedIds.size} contacts assigned`,
      );
      setSelectedIds(new Set());
      setAssigneeId("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div
          className={
            actorRole !== "SUPER_ADMIN"
              ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
              : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          }
        >
          <StatCard label="Total contacts" value={stats.total} />
          <StatCard label="Assigned" value={stats.assigned} />
          <StatCard label="Unassigned" value={stats.unassigned} />
          <StatCard label="Ready to assign" value={stats.assignedToMe} />
          {actorRole !== "SUPER_ADMIN" ? (
            <StatCard label="Kept for my calls" value={stats.heldForOwnCalls} />
          ) : null}
        </div>
      ) : null}

      <DistributionModeTabs mode={mode} onModeChange={setMode} />

      {mode === "equal" ? (
        <EqualSplitPanel
          key={`${stats.assignedToMe}-${stats.heldForOwnCalls}-${assignees.map((assignee) => assignee.id).join(",")}`}
          campaignId={campaignId}
          actorRole={actorRole}
          poolContactCount={stats.assignedToMe}
          assignees={assignees}
        />
      ) : assignees.length === 0 ? (
        <NoAssigneesDistributionEmpty
          actorRole={actorRole}
          title="Assign contacts manually"
          readyContactCount={stats.assignedToMe}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign contacts manually</CardTitle>
              <CardDescription>
                Distribute contacts for {campaignName}. Selected: {selectedIds.size}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DistributionPoolFilter
                currentPool={initialPool}
                showFilters={actorRole === "SUPER_ADMIN"}
              />

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="distribution-search">Search</Label>
                  <Input
                    id="distribution-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{assigneeLabel}</Label>
                  <Select
                    value={assigneeId}
                    items={assigneeItems}
                    onValueChange={(value) => setAssigneeId(value ?? "")}
                  >
                    <SelectTrigger className="w-full md:min-w-56">
                      <SelectValue placeholder={`Select ${assigneeLabel.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignees.map((assignee) => (
                        <SelectItem key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={toggleAllVisible}>
                  {allVisibleSelected ? "Clear selection" : "Select all visible"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button disabled={isPending || selectedIds.size === 0 || !assigneeId}>
                        {isPending ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Users />
                            Assign {selectedIds.size} contact
                            {selectedIds.size === 1 ? "" : "s"}
                          </>
                        )}
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm assignment</AlertDialogTitle>
                      <AlertDialogDescription>
                        Assign {selectedIds.size} contact
                        {selectedIds.size === 1 ? "" : "s"} to the selected{" "}
                        {assigneeLabel.toLowerCase()}? Previous assignments will be
                        preserved in history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAssign} disabled={isPending}>
                        Confirm assignment
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {filteredContacts.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              No contacts available for assignment with the current filters.
            </div>
          ) : (
            <>
              <div className="hidden rounded-xl border md:block">
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium">
                  <span>Select</span>
                  <span>Name</span>
                  <span>Phone</span>
                  <span>Status</span>
                  <span>Current assignee</span>
                </div>
                {filteredContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      className="size-4 rounded border-input"
                    />
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {contact.phone}
                    </span>
                    <AssignmentStatusBadge status={contact.assignment_status} />
                    <span className="text-sm">
                      {contact.assignee_name ?? "Unassigned"}
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid gap-3 md:hidden">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedIds.has(contact.id);

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleContact(contact.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {contact.phone}
                          </p>
                        </div>
                        {isSelected ? (
                          <Check className="size-5 text-primary" />
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <AssignmentStatusBadge status={contact.assignment_status} />
                        {contact.assignee_name ? (
                          <span className="text-xs text-muted-foreground">
                            {contact.assignee_role
                              ? getRoleLabel(contact.assignee_role)
                              : "Assignee"}
                            : {contact.assignee_name}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
