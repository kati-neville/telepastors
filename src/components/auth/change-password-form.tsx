"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { changePasswordAction } from "@/app/actions/password";
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
  changePasswordSchema,
  PASSWORD_REQUIREMENTS,
  type ChangePasswordValues,
} from "@/lib/validations/password";

export function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await changePasswordAction(values);

      if (!result.success) {
        setServerError(result.error);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    });
  });

  return (
    <Card className="border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl">Set a new password</CardTitle>
        <CardDescription>
          Your account is using a temporary password. Choose a strong new
          password before continuing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {serverError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.newPassword.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Password requirements</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {PASSWORD_REQUIREMENTS.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Updating password...
              </>
            ) : (
              "Save new password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
