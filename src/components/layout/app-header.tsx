import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { AuthSession } from "@/types/domain";
import type { VisibleNavItem } from "@/lib/navigation/types";

type AppHeaderProps = {
	session: AuthSession;
	navItems: VisibleNavItem[];
	title?: string;
};

export function AppHeader({ session, navItems, title }: AppHeaderProps) {
	return (
		<header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
			<MobileNav
				items={navItems}
				telepastor={session.telepastor}
				email={session.loginIdentifier}
			/>
			<div className="min-w-0 flex-1">
				{title ? (
					<h1 className="truncate font-heading text-lg font-semibold">
						{title}
					</h1>
				) : (
					<p className="truncate text-sm text-muted-foreground">
						Telepastors Ministry
					</p>
				)}
			</div>
			<UserMenu telepastor={session.telepastor} email={session.loginIdentifier} />
		</header>
	);
}
