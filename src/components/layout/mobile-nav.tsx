"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { MobileAccountFooter } from "@/components/layout/account-footer";
import { NavIcon } from "@/components/layout/nav-icon";
import { getNavItemClassName } from "@/components/layout/nav-item-link";
import type { VisibleNavItem } from "@/lib/navigation/types";
import type { Telepastor } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type SheetActions = {
	close: () => void;
	unmount: () => void;
};

type MobileNavProps = {
	items: VisibleNavItem[];
	telepastor: Telepastor;
	email: string;
};

export function MobileNav({ items, telepastor, email }: MobileNavProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const actionsRef = useRef<SheetActions | null>(null);

	useEffect(() => {
		setOpen(false);
		actionsRef.current?.close();
	}, [pathname]);

	function navigate(href: string) {
		setOpen(false);
		actionsRef.current?.close();
		router.push(href);
	}

	return (
		<Sheet open={open} onOpenChange={setOpen} actionsRef={actionsRef}>
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
					{items.map((item) => {
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`);

						return (
							<button
								key={item.href}
								type="button"
								className={getNavItemClassName(isActive, "sheet")}
								onClick={() => navigate(item.href)}
							>
								<NavIcon name={item.icon} className="size-4 shrink-0" />
								<span className="min-w-0 flex-1 truncate text-left">
									{item.title}
								</span>
								{item.showBirthdayIndicator ? <BirthdayNavIndicator /> : null}
							</button>
						);
					})}
				</nav>
				<MobileAccountFooter
					telepastor={telepastor}
					email={email}
					onNavigate={navigate}
				/>
			</SheetContent>
		</Sheet>
	);
}

function BirthdayNavIndicator() {
	return (
		<span className="ml-auto inline-flex items-center gap-1.5">
			<span className="size-2 rounded-full bg-amber-500" aria-hidden />
			<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
				Today
			</span>
		</span>
	);
}
