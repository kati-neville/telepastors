import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { BirthdayNoticeBanner } from "@/components/birthdays/birthday-notice-banner";
import { getVisibleNavItems } from "@/lib/navigation/config";
import { canAccessBirthdays } from "@/lib/auth/permissions";
import { fetchBirthdayNotice } from "@/lib/queries/birthdays";
import { requireAuthSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const birthdayNotice = await fetchBirthdayNotice(context);
  const navItems = getVisibleNavItems(context, {
    highlightBirthdaysNav:
      canAccessBirthdays(context) && birthdayNotice.todaysBirthdays.length > 0,
  });

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
          <BirthdayNoticeBanner notice={birthdayNotice} context={context} />
          {children}
        </main>
        <MobileBottomNav items={navItems} />
      </div>
    </div>
  );
}
