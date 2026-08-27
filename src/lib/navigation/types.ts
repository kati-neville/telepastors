export type NavIconName =
  | "layout-dashboard"
  | "users"
  | "folder-kanban"
  | "share-2"
  | "phone-call"
  | "bar-chart-3"
  | "megaphone"
  | "message-square";

export type VisibleNavItem = {
  title: string;
  href: string;
  icon: NavIconName;
};
