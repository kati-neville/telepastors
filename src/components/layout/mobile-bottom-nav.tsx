"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icon";
import { cn } from "@/lib/utils";
import type { VisibleNavItem } from "@/lib/navigation/types";

type MobileBottomNavProps = {
  items: VisibleNavItem[];
};

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const primaryItems = items.slice(0, 4);

  if (primaryItems.length === 0) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {primaryItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <NavIcon name={item.icon} className="size-5" />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
