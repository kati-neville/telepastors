import { redirect } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation/config";
import { requireAuthSession } from "@/lib/auth/session";

export async function enforcePageAccess(href: string) {
  const session = await requireAuthSession();
  const navItem = NAV_ITEMS.find((item) => item.href === href);

  if (navItem && !navItem.isVisible({ telepastor: session.telepastor })) {
    redirect("/dashboard");
  }

  return session;
}
