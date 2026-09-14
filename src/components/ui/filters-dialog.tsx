"use client";

import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FiltersDialogProps = {
	children: ReactNode;
	description?: string;
	title?: string;
	triggerLabel?: string;
	activeCount?: number;
	onClear?: () => void;
	clearLabel?: string;
	contentClassName?: string;
	className?: string;
};

export function FiltersDialog({
	children,
	description,
	title = "Filters",
	triggerLabel = "Filters",
	activeCount = 0,
	onClear,
	clearLabel = "Clear",
	contentClassName,
	className,
}: FiltersDialogProps) {
	return (
		<div className={cn("flex justify-end", className)}>
			<Dialog>
				<DialogTrigger
					render={<Button type="button" variant="outline" className="gap-2" />}
				>
					<ListFilter className="size-4" />
					{triggerLabel}
					{activeCount > 0 ? (
						<Badge variant="secondary" className="rounded-full px-1.5">
							{activeCount}
						</Badge>
					) : null}
				</DialogTrigger>
				<DialogContent className={cn("sm:max-w-lg", contentClassName)}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						{description ? (
							<DialogDescription>{description}</DialogDescription>
						) : null}
					</DialogHeader>

					<div className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
						{children}
					</div>

					<DialogFooter>
						{onClear ? (
							<Button
								type="button"
								variant="ghost"
								className="sm:mr-auto"
								onClick={onClear}
								disabled={activeCount === 0}
							>
								{clearLabel}
							</Button>
						) : null}
						<DialogClose render={<Button type="button" />}>Done</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

type FilterFieldProps = {
	label: string;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
};

export function FilterField({
	label,
	htmlFor,
	children,
	className,
}: FilterFieldProps) {
	return (
		<div className={cn("space-y-2", className)}>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}
