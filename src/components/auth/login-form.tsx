"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { AuthRedirectOverlay } from "@/components/auth/auth-redirect-overlay";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  profile_missing:
    "Your account is not linked to a ministry profile. Contact a Super Admin.",
  inactive: "Your ministry account is inactive. Contact a Super Admin.",
  invalid_credentials: "Invalid email, phone number, or password.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const queryError = searchParams.get("error");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values);

      if (!result.success) {
        setServerError(
          ERROR_MESSAGES[result.error] ?? "Unable to sign in. Please try again.",
        );
        return;
      }

      if (result.mustChangePassword) {
        setRedirectMessage("Preparing your account...");
        router.replace(
          `/change-password?redirectTo=${encodeURIComponent(redirectTo)}`,
        );
        router.refresh();
        return;
      }

      setRedirectMessage("Opening your workspace...");
      router.replace(redirectTo);
      router.refresh();
    });
  });

  return (
    <>
      {redirectMessage ? <AuthRedirectOverlay message={redirectMessage} /> : null}
      <Card className="border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl">Sign in</CardTitle>
        <CardDescription>
          Access the Telepastors Ministry workspace with your assigned account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {(serverError || queryError) && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {serverError ??
                ERROR_MESSAGES[queryError ?? ""] ??
                "Unable to sign in."}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="identifier">Email or phone</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@example.com or 0241234567"
              {...form.register("identifier")}
            />
            {form.formState.errors.identifier ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.identifier.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
    </>
  );
}
