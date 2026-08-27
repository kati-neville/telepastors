"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MobileAccountFooter } from "@/components/layout/account-footer";
import { NavIcon } from "@/components/layout/nav-icon";
import { cn } from "@/lib/utils";
import type { VisibleNavItem } from "@/lib/navigation/types";
import type { Telepastor } from "@/types/domain";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MobileNavProps = {
  items: VisibleNavItem[];
  telepastor: Telepastor;
  email: string;
};

export function MobileNav({ items, telepastor, email }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </Button>
        }
      />
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>Telepastors</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <NavIcon name={item.icon} className="size-4 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <MobileAccountFooter telepastor={telepastor} email={email} />
      </SheetContent>
    </Sheet>
  );
}
