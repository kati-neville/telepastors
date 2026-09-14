"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getRoleLabel } from "@/lib/auth/roles";
import type { Telepastor } from "@/types/domain";

type AccountFooterProps = {
	telepastor: Telepastor;
	email: string;
};

function getInitials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function SidebarAccountFooter({
	telepastor,
	email,
}: AccountFooterProps) {
	return (
		<div className="shrink-0 border-t p-4">
			<Link
				href="/profile"
				className="mb-3 flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/60"
			>
				<Avatar size="sm">
					{telepastor.profile_picture_url ? (
						<AvatarImage
							src={telepastor.profile_picture_url}
							alt={telepastor.name}
						/>
					) : null}
					<AvatarFallback>{getInitials(telepastor.name)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">{telepastor.name}</p>
					<p className="truncate text-xs text-muted-foreground">{email}</p>
					<p className="truncate text-xs text-muted-foreground">
						{getRoleLabel(telepastor.role)}
					</p>
				</div>
			</Link>

			<SignOutButton variant="sidebar" />
		</div>
	);
}

export function MobileAccountFooter({
	telepastor,
	email,
	onNavigate,
}: AccountFooterProps & { onNavigate: (href: string) => void }) {
	return (
		<div className="mt-auto border-t p-4">
			<button
				type="button"
				onClick={() => onNavigate("/profile")}
				className="mb-3 block w-full rounded-lg px-1 py-1 text-left hover:bg-accent/60"
			>
				<p className="truncate text-sm font-medium">{telepastor.name}</p>
				<p className="truncate text-xs text-muted-foreground">{email}</p>
				<p className="truncate text-xs text-muted-foreground">
					{getRoleLabel(telepastor.role)}
				</p>
			</button>

			<SignOutButton
				variant="sidebar"
				className="text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
			/>
		</div>
	);
}
