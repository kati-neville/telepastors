import Link from "next/link";
import { NavIcon } from "@/components/layout/nav-icon";
import { cn } from "@/lib/utils";
import type { VisibleNavItem } from "@/lib/navigation/types";

type NavItemLinkProps = {
  item: VisibleNavItem;
  isActive: boolean;
  className?: string;
  iconClassName?: string;
  layout?: "sidebar" | "sheet" | "mobile";
};

export function NavItemLink({
  item,
  isActive,
  className,
  iconClassName = "size-4 shrink-0",
  layout = "sidebar",
}: NavItemLinkProps) {
  const showTitleWithBadge = layout !== "mobile";

  return (
    <Link href={item.href} className={className}>
      <NavIcon name={item.icon} className={iconClassName} />
      {showTitleWithBadge ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.showBirthdayIndicator ? <BirthdayNavIndicator /> : null}
        </>
      ) : (
        <span className="relative truncate">
          {item.title}
          {item.showBirthdayIndicator ? (
            <span
              className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500"
              aria-hidden
            />
          ) : null}
        </span>
      )}
    </Link>
  );
}

function BirthdayNavIndicator() {
  return (
    <span className="ml-auto inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full bg-amber-500" aria-hidden />
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Today
      </span>
    </span>
  );
}

export function getNavItemClassName(
  isActive: boolean,
  layout: NavItemLinkProps["layout"] = "sidebar",
) {
  if (layout === "sheet") {
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
      isActive
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
    );
  }

  if (layout === "mobile") {
    return cn(
      "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );
  }

  return cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );
}
