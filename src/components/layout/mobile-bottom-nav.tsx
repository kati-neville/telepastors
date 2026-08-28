"use client";

import { usePathname } from "next/navigation";
import {
  getNavItemClassName,
  NavItemLink,
} from "@/components/layout/nav-item-link";
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
            <NavItemLink
              key={item.href}
              item={item}
              isActive={isActive}
              layout="mobile"
              iconClassName="size-5"
              className={getNavItemClassName(isActive, "mobile")}
            />
          );
        })}
      </div>
    </nav>
  );
}
