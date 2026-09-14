"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { updateTelepastorRoleAction } from "@/app/actions/telepastors";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getRoleLabel } from "@/lib/auth/roles";
import type { TelepastorDetail, TelepastorSummary } from "@/types/domain";

type RoleManagementSectionProps = {
  telepastor: TelepastorDetail;
  governors: TelepastorSummary[];
  leaders: TelepastorSummary[];
};

export function RoleManagementSection({
  telepastor,
  governors,
  leaders,
}: RoleManagementSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<"GOVERNOR" | "LEADER" | "TELEPASTOR">(
    telepastor.role === "SUPER_ADMIN"
      ? "TELEPASTOR"
      : (telepastor.role as "GOVERNOR" | "LEADER" | "TELEPASTOR"),
  );
  const [governorId, setGovernorId] = useState<string | null>(
    telepastor.governor_id,
  );
  const [leaderId, setLeaderId] = useState<string | null>(telepastor.leader_id);
  const [open, setOpen] = useState(false);

  const filteredLeaders = useMemo(() => {
    if (!governorId) {
      return leaders;
    }

    return leaders.filter((leader) => leader.governor_id === governorId);
  }, [governorId, leaders]);

  const governorItems = useMemo(
    () =>
      governors.map((governor) => ({
        label: governor.name,
        value: governor.id,
      })),
    [governors],
  );

  const leaderItems = useMemo(
    () =>
      filteredLeaders.map((leader) => ({
        label: leader.name,
        value: leader.id,
      })),
    [filteredLeaders],
  );

  if (telepastor.role === "SUPER_ADMIN") {
    return null;
  }

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await updateTelepastorRoleAction(telepastor.id, {
        role,
        governor_id:
          role === "LEADER" || role === "TELEPASTOR" ? governorId : null,
        leader_id: role === "TELEPASTOR" ? leaderId : null,
        confirm: true,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Ministry role updated");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 text-amber-600" />
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-semibold">Ministry Role</h3>
          <p className="text-sm text-muted-foreground">
            Role changes affect permissions across the ministry. This section is
            separate from everyday profile edits.
          </p>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Current role</Label>
          <p className="text-sm font-medium">{getRoleLabel(telepastor.role)}</p>
        </div>

        <div className="space-y-2">
          <Label>New role</Label>
          <Select
            value={role}
            onValueChange={(value) => {
              if (!value) return;
              setRole(value as typeof role);
              setGovernorId(null);
              setLeaderId(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TELEPASTOR">Telepastor</SelectItem>
              <SelectItem value="LEADER">Leader</SelectItem>
              <SelectItem value="GOVERNOR">Governor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {role === "LEADER" || role === "TELEPASTOR" ? (
          <div className="space-y-2">
            <Label>Governor</Label>
            <Select
              value={governorId ?? ""}
              items={governorItems}
              onValueChange={(value) => {
                setGovernorId(value || null);
                setLeaderId(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select governor" />
              </SelectTrigger>
              <SelectContent>
                {governors.map((governor) => (
                  <SelectItem key={governor.id} value={governor.id}>
                    {governor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {role === "TELEPASTOR" ? (
          <div className="space-y-2">
            <Label>Leader (optional)</Label>
            <Select
              value={leaderId ?? "__none__"}
              items={[
                { label: "No leader (direct to Governor)", value: "__none__" },
                ...leaderItems,
              ]}
              onValueChange={(value) =>
                setLeaderId(!value || value === "__none__" ? null : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  No leader (direct to Governor)
                </SelectItem>
                {filteredLeaders.map((leader) => (
                  <SelectItem key={leader.id} value={leader.id}>
                    {leader.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" disabled={isPending}>
                Update ministry role
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm ministry role change</AlertDialogTitle>
              <AlertDialogDescription>
                You are changing {telepastor.name} from{" "}
                {getRoleLabel(telepastor.role)} to {getRoleLabel(role)}. This
                will immediately affect what they can access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Confirm role change"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
