"use client";

import { Loader2, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "button" | "sidebar";
  className?: string;
  label?: string;
};

function SignOutSubmitButton({
  variant,
  className,
  label,
}: SignOutButtonProps) {
  const { pending } = useFormStatus();

  if (variant === "sidebar") {
    return (
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : (
          <LogOut className="size-4 shrink-0" />
        )}
        {label}
      </button>
    );
  }

  return (
    <Button
      type="submit"
      variant="outline"
      className={className}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      {label}
    </Button>
  );
}

export function SignOutButton({
  variant = "button",
  className,
  label = "Log out",
}: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <SignOutSubmitButton
        variant={variant}
        className={className}
        label={label}
      />
    </form>
  );
}
