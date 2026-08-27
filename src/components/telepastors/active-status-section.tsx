"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleTelepastorActiveAction } from "@/app/actions/telepastors";
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
import { ActiveStatusBadge } from "@/components/telepastors/telepastor-status-badge";
import type { TelepastorDetail } from "@/types/domain";

export function ActiveStatusSection({
  telepastor,
}: {
  telepastor: TelepastorDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const nextStatus = !telepastor.is_active;
  const actionLabel = nextStatus ? "Reactivate member" : "Deactivate member";

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await toggleTelepastorActiveAction(telepastor.id, {
        is_active: nextStatus,
        confirm: true,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        nextStatus ? "Member reactivated" : "Member deactivated",
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h3 className="font-heading text-lg font-semibold">Account status</h3>
          <p className="text-sm text-muted-foreground">
            Deactivating keeps ministry history intact while removing active
            access.
          </p>
          <ActiveStatusBadge isActive={telepastor.is_active} />
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={
              <Button
                variant={nextStatus ? "default" : "destructive"}
                disabled={isPending}
              >
                {actionLabel}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionLabel}</AlertDialogTitle>
              <AlertDialogDescription>
                {nextStatus
                  ? `${telepastor.name} will become active again and regain access according to their role.`
                  : `${telepastor.name} will be marked inactive. Their record and history will remain in the system.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
