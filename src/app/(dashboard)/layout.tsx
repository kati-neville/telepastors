import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { getVisibleNavItems } from "@/lib/navigation/config";
import { requireAuthSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession();
  const navItems = getVisibleNavItems({ telepastor: session.telepastor });

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar
        items={navItems}
        telepastor={session.telepastor}
        email={session.loginIdentifier}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader session={session} navItems={navItems} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8">
          {children}
        </main>
        <MobileBottomNav items={navItems} />
      </div>
    </div>
  );
}
