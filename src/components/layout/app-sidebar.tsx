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
};

export function AppSidebar({ items, telepastor, email }: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
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
			<SidebarAccountFooter telepastor={telepastor} email={email} />
		</aside>
	);
}
