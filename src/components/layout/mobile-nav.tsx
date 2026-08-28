"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { MobileAccountFooter } from "@/components/layout/account-footer";
import {
	getNavItemClassName,
	NavItemLink,
} from "@/components/layout/nav-item-link";
import type { VisibleNavItem } from "@/lib/navigation/types";
import type { Telepastor } from "@/types/domain";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

type MobileNavProps = {
	items: VisibleNavItem[];
	telepastor: Telepastor;
	email: string;
};

export function MobileNav({ items, telepastor, email }: MobileNavProps) {
	const pathname = usePathname();

	return (
		<Sheet>
			<SheetTrigger
				render={
					<Button variant="outline" size="icon" className="md:hidden">
						<Menu className="size-4" />
						<span className="sr-only">Open navigation</span>
					</Button>
				}
			/>
			<SheetContent side="left" className="flex w-72 flex-col p-0">
				<nav className="flex flex-col gap-1 p-4">
					{items.map(item => {
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`);

						return (
							<NavItemLink
								key={item.href}
								item={item}
								isActive={isActive}
								layout="sheet"
								className={getNavItemClassName(isActive, "sheet")}
							/>
						);
					})}
				</nav>
				<MobileAccountFooter telepastor={telepastor} email={email} />
			</SheetContent>
		</Sheet>
	);
}
