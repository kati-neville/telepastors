"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resetTelepastorPasswordAction } from "@/app/actions/telepastors";
import { TelepastorCredentialsDialog } from "@/components/telepastors/telepastor-credentials-dialog";
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
import { DEFAULT_TELEPASTOR_PASSWORD } from "@/lib/auth/default-password";
import type { TelepastorDetail } from "@/types/domain";

type ResetPasswordSectionProps = {
  telepastor: TelepastorDetail;
};

type ResetCredentials = {
  name: string;
  phone: string;
  temporaryPassword: string;
};

export function ResetPasswordSection({ telepastor }: ResetPasswordSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [credentials, setCredentials] = useState<ResetCredentials | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await resetTelepastorPasswordAction(telepastor.id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setConfirmOpen(false);
      setCredentials({
        name: result.name ?? telepastor.name,
        phone: result.phone ?? telepastor.phone,
        temporaryPassword:
          result.temporaryPassword ?? DEFAULT_TELEPASTOR_PASSWORD,
      });
      router.refresh();
    });
  };

  return (
    <>
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h3 className="font-heading text-lg font-semibold">Sign-in password</h3>
            <p className="text-sm text-muted-foreground">
              Reset {telepastor.name}&apos;s password to the default{" "}
              <span className="font-mono font-medium text-foreground">
                {DEFAULT_TELEPASTOR_PASSWORD}
              </span>
              . They will be required to choose a new password the next time they
              sign in.
            </p>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="outline" disabled={isPending}>
                  <KeyRound />
                  Reset password
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset password?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will set {telepastor.name}&apos;s password back to{" "}
                  <span className="font-mono font-medium text-foreground">
                    {DEFAULT_TELEPASTOR_PASSWORD}
                  </span>
                  . Their current password will stop working immediately, and
                  they will be prompted to choose a new one after signing in.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <TelepastorCredentialsDialog
        open={credentials !== null}
        name={credentials?.name ?? telepastor.name}
        phone={credentials?.phone ?? telepastor.phone}
        temporaryPassword={
          credentials?.temporaryPassword ?? DEFAULT_TELEPASTOR_PASSWORD
        }
        onContinue={() => setCredentials(null)}
      />
    </>
  );
}
