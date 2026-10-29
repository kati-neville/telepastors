"use client";

import { usePathname } from "next/navigation";

import { SidebarAccountFooter } from "@/components/layout/account-footer";
import {
	getNavItemClassName,
	NavItemLink,
} from "@/components/layout/nav-item-link";
import type { VisibleNavItem } from "@/lib/navigation/types";
import type { Telepastor } from "@/types/domain";

type AppSidebarProps = {
	items: VisibleNavItem[];
	telepastor: Telepastor;
	email: string;
	organizationName?: string;
};

export function AppSidebar({
	items,
	telepastor,
	email,
	organizationName,
}: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="hidden h-full min-h-0 w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
			{organizationName ? (
				<div className="flex h-16 shrink-0 flex-col justify-center border-b px-4">
					<p className="truncate font-heading text-sm font-semibold tracking-tight">
						{organizationName}
					</p>
					<p className="truncate text-xs text-muted-foreground">Telepastors</p>
				</div>
			) : null}
			<nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
				{items.map(item => {
					const isActive =
						pathname === item.href || pathname.startsWith(`${item.href}/`);

					return (
						<NavItemLink
							key={item.href}
							item={item}
							isActive={isActive}
							className={getNavItemClassName(isActive, "sidebar")}
						/>
					);
				})}
			</nav>
			<SidebarAccountFooter
				telepastor={telepastor}
				email={email}
				organizationName={organizationName}
			/>
		</aside>
	);
}
