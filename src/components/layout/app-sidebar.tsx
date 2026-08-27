"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icon";
import { SidebarAccountFooter } from "@/components/layout/account-footer";
import { cn } from "@/lib/utils";
import type { VisibleNavItem } from "@/lib/navigation/types";
import type { Telepastor } from "@/types/domain";

type AppSidebarProps = {
  items: VisibleNavItem[];
  telepastor: Telepastor;
  email: string;
};

export function AppSidebar({ items, telepastor, email }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-16 shrink-0 items-center border-b px-6">
        <Link href="/dashboard" className="font-heading text-lg font-semibold">
          Telepastors
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <NavIcon name={item.icon} className="size-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <SidebarAccountFooter telepastor={telepastor} email={email} />
    </aside>
  );
}
