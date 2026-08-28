import "server-only";

import {
  canAccessBroadcasts,
  canAccessBirthdays,
  canAccessCampaigns,
  canAccessMyCalls,
  canAccessReports,
  canAccessTelepastorsDirectory,
  type AuthorizationContext,
} from "@/lib/auth/permissions";
import { canDistributeContacts } from "@/lib/auth/assignments";
import { canManageWhatsAppTemplates } from "@/lib/auth/broadcasts";
import type { VisibleNavItem } from "@/lib/navigation/types";

type NavItemDefinition = VisibleNavItem & {
  isVisible: (context: AuthorizationContext) => boolean;
};

export const NAV_ITEMS: NavItemDefinition[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "layout-dashboard",
    isVisible: () => true,
  },
  {
    title: "Telepastors",
    href: "/telepastors",
    icon: "users",
    isVisible: canAccessTelepastorsDirectory,
  },
  {
    title: "Birthdays",
    href: "/birthdays",
    icon: "cake",
    isVisible: canAccessBirthdays,
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    icon: "folder-kanban",
    isVisible: canAccessCampaigns,
  },
  {
    title: "Distribute",
    href: "/assignments",
    icon: "share-2",
    isVisible: canDistributeContacts,
  },
  {
    title: "My Calls",
    href: "/my-calls",
    icon: "phone-call",
    isVisible: canAccessMyCalls,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: "bar-chart-3",
    isVisible: canAccessReports,
  },
  {
    title: "Broadcasts",
    href: "/broadcasts",
    icon: "megaphone",
    isVisible: canAccessBroadcasts,
  },
  {
    title: "Message Templates",
    href: "/broadcasts/templates",
    icon: "message-square",
    isVisible: canManageWhatsAppTemplates,
  },
];

export function getVisibleNavItems(
  context: AuthorizationContext,
  options?: { highlightBirthdaysNav?: boolean },
): VisibleNavItem[] {
  return NAV_ITEMS.filter((item) => item.isVisible(context)).map(
    (item): VisibleNavItem => ({
      title: item.title,
      href: item.href,
      icon: item.icon,
      showBirthdayIndicator:
        item.href === "/birthdays" && options?.highlightBirthdaysNav,
    }),
  );
}
