import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { AppLogo } from "@/components/layout/app-logo";
import { requireAuthSession } from "@/lib/auth/session";

export default async function ChangePasswordPage() {
  const session = await requireAuthSession({ allowPasswordChangePending: true });

  if (!session.telepastor.must_change_password) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <AppLogo size="lg" priority />
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Secure your account
          </h1>
        </div>
        <Suspense
          fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
        >
          <ChangePasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
