"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TelepastorCredentialsDialogProps = {
  open: boolean;
  name: string;
  phone: string;
  temporaryPassword: string;
  onContinue: () => void;
};

export function TelepastorCredentialsDialog({
  open,
  name,
  phone,
  temporaryPassword,
  onContinue,
}: TelepastorCredentialsDialogProps) {
  const [copiedField, setCopiedField] = useState<"phone" | "password" | null>(
    null,
  );

  async function copyValue(
    value: string,
    field: "phone" | "password",
    label: string,
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Share sign-in details
          </DialogTitle>
          <DialogDescription>
            {name} can sign in with their phone number and the default password{" "}
            <span className="font-mono font-medium text-foreground">telepastor</span>
            . They will be required to choose a new password on first sign-in.
            Share these details securely with them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone number
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm">{phone}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyValue(phone, "phone", "Phone number")}
              >
                {copiedField === "phone" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Temporary password
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="break-all font-mono text-sm">{temporaryPassword}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyValue(temporaryPassword, "password", "Temporary password")
                }
              >
                {copiedField === "password" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Copy
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onContinue}>
            I have shared these details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TelepastorCredentialsDialogHost({
  credentials,
  onClose,
}: {
  credentials: {
    id: string;
    name: string;
    phone: string;
    temporaryPassword: string;
  } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!credentials) {
    return null;
  }

  return (
    <TelepastorCredentialsDialog
      open
      name={credentials.name}
      phone={credentials.phone}
      temporaryPassword={credentials.temporaryPassword}
      onContinue={() => {
        startTransition(() => {
          onClose();
          router.push(`/telepastors/${credentials.id}`);
          router.refresh();
        });
      }}
    />
  );
}
