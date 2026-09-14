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
	clearDisabled?: boolean;
	onClear?: () => void;
	onDone?: () => void;
	clearLabel?: string;
	doneLabel?: string;
	contentClassName?: string;
	className?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function FiltersDialog({
	children,
	description,
	title = "Filters",
	triggerLabel = "Filters",
	activeCount = 0,
	clearDisabled,
	onClear,
	onDone,
	clearLabel = "Clear",
	doneLabel = "Done",
	contentClassName,
	className,
	open,
	onOpenChange,
}: FiltersDialogProps) {
	const isClearDisabled = clearDisabled ?? activeCount === 0;

	return (
		<div className={cn("flex justify-end", className)}>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogTrigger
					render={<Button type="button" variant="outline" className="gap-2" />}>
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
								disabled={isClearDisabled}>
								{clearLabel}
							</Button>
						) : null}
						{onDone ? (
							<Button
								type="button"
								onClick={() => {
									onDone();
									onOpenChange?.(false);
								}}>
								{doneLabel}
							</Button>
						) : (
							<DialogClose render={<Button type="button" />}>
								{doneLabel}
							</DialogClose>
						)}
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
