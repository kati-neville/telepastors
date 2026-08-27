import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Telepastors Ministry
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
        </div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
