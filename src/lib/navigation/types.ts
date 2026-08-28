export type NavIconName =
  | "layout-dashboard"
  | "users"
  | "cake"
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
  showBirthdayIndicator?: boolean;
};
