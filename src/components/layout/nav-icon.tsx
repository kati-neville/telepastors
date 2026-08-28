"use client";

import {
  BarChart3,
  Cake,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/navigation/types";

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  cake: Cake,
  "folder-kanban": FolderKanban,
  "share-2": Share2,
  "phone-call": PhoneCall,
  "bar-chart-3": BarChart3,
  megaphone: Megaphone,
  "message-square": MessageSquare,
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

export function NavIcon({ name, className }: NavIconProps) {
  const Icon = NAV_ICONS[name];
  return <Icon className={className} />;
}
