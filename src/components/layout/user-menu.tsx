"use client";

import Link from "next/link";
import { Loader2, LogOut, UserRound } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getRoleLabel } from "@/lib/auth/roles";
import type { Telepastor } from "@/types/domain";

type UserMenuProps = {
  telepastor: Telepastor;
  email: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SignOutMenuItem() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      Log out
    </button>
  );
}

export function UserMenu({ telepastor, email }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Open account menu"
            className={buttonVariants({
              variant: "ghost",
              className: "h-auto gap-2 px-2 py-1.5",
            })}
          />
        }
      >
        <Avatar size="sm">
          {telepastor.profile_picture_url ? (
            <AvatarImage src={telepastor.profile_picture_url} alt={telepastor.name} />
          ) : null}
          <AvatarFallback>{getInitials(telepastor.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-left text-sm font-medium sm:inline">
          {telepastor.name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{telepastor.name}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
              <span className="text-xs text-muted-foreground">
                {getRoleLabel(telepastor.role)}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserRound className="size-4" />
            My profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <form action={signOutAction}>
            <SignOutMenuItem />
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
