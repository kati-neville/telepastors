"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FilterField, FiltersDialog } from "@/components/ui/filters-dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";
import {
	DEFAULT_TELEPASTORS_FILTERS,
	type TelepastorsFilterValues,
} from "@/lib/validations/telepastors";

const ALL_VALUE = "__all__";

const ROLE_ITEMS = [
	{ value: "ALL", label: "All roles" },
	{ value: "GOVERNOR", label: "Governors" },
	{ value: "LEADER", label: "Leaders" },
	{ value: "TELEPASTOR", label: "Telepastors" },
] as const;

const STATUS_ITEMS = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
] as const;

type TelepastorsFiltersProps = {
	viewerRole: MinistryRole;
	governors: TelepastorSummary[];
	leaders: TelepastorSummary[];
	filters: TelepastorsFilterValues;
	onFiltersChange: (filters: TelepastorsFilterValues) => void;
	className?: string;
};

function countActiveFilters(
	filters: TelepastorsFilterValues,
	viewerRole: MinistryRole,
) {
	return [
		Boolean(filters.q?.trim()),
		filters.role !== "ALL",
		viewerRole === "SUPER_ADMIN" && Boolean(filters.governor),
		(viewerRole === "SUPER_ADMIN" || viewerRole === "GOVERNOR") &&
			Boolean(filters.leader),
		filters.status !== "all",
	].filter(Boolean).length;
}

export function TelepastorsFilters({
	viewerRole,
	governors,
	leaders,
	filters,
	onFiltersChange,
	className,
}: TelepastorsFiltersProps) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<TelepastorsFilterValues>(filters);

	const appliedCount = countActiveFilters(filters, viewerRole);
	const draftCount = countActiveFilters(draft, viewerRole);

	const governorItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All governors" },
			...governors.map((governor) => ({
				value: governor.id,
				label: governor.name,
			})),
		],
		[governors],
	);

	const leaderItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All leaders" },
			...leaders.map((leader) => ({
				value: leader.id,
				label: leader.name,
			})),
		],
		[leaders],
	);

	const updateDraft = (updates: Partial<TelepastorsFilterValues>) => {
		setDraft((current) => ({ ...current, ...updates }));
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(filters);
		}
		setOpen(nextOpen);
	};

	return (
		<FiltersDialog
			description="Search by name or phone, and narrow by role, team, or status."
			activeCount={appliedCount}
			clearDisabled={draftCount === 0}
			onClear={() => setDraft(DEFAULT_TELEPASTORS_FILTERS)}
			onDone={() => onFiltersChange(draft)}
			open={open}
			onOpenChange={handleOpenChange}
			contentClassName="sm:max-w-xl"
			className={className}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<FilterField
					label="Search"
					htmlFor="telepastors-search"
					className="sm:col-span-2"
				>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="telepastors-search"
							value={draft.q ?? ""}
							placeholder="Search by name or phone"
							className="pl-8"
							onChange={(event) =>
								updateDraft({ q: event.target.value || undefined })
							}
						/>
					</div>
				</FilterField>

				<FilterField label="Role">
					<Select
						value={draft.role}
						items={[...ROLE_ITEMS]}
						onValueChange={(value) => {
							if (!value) return;
							updateDraft({
								role: value as TelepastorsFilterValues["role"],
							});
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All roles" />
						</SelectTrigger>
						<SelectContent>
							{ROLE_ITEMS.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Status">
					<Select
						value={draft.status}
						items={[...STATUS_ITEMS]}
						onValueChange={(value) => {
							if (!value) return;
							updateDraft({
								status: value as TelepastorsFilterValues["status"],
							});
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_ITEMS.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				{viewerRole === "SUPER_ADMIN" ? (
					<FilterField label="Governor">
						<Select
							value={draft.governor ?? ALL_VALUE}
							items={governorItems}
							onValueChange={(value) =>
								updateDraft({
									governor:
										!value || value === ALL_VALUE ? undefined : value,
									leader: undefined,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All governors" />
							</SelectTrigger>
							<SelectContent>
								{governorItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>
				) : null}

				{viewerRole === "SUPER_ADMIN" || viewerRole === "GOVERNOR" ? (
					<FilterField label="Leader">
						<Select
							value={draft.leader ?? ALL_VALUE}
							items={leaderItems}
							onValueChange={(value) =>
								updateDraft({
									leader: !value || value === ALL_VALUE ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All leaders" />
							</SelectTrigger>
							<SelectContent>
								{leaderItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>
				) : null}
			</div>
		</FiltersDialog>
	);
}

export function TelepastorsEmptyState({
	canCreate,
	canImport = false,
}: {
	canCreate: boolean;
	canImport?: boolean;
}) {
	return (
		<div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
			<h3 className="font-heading text-lg font-semibold">
				No Telepastors found
			</h3>
			<p className="mt-2 text-sm text-muted-foreground">
				Try adjusting your search or filters.
			</p>
			<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
				{canCreate ? (
					<Link
						href="/telepastors/new"
						className="inline-flex text-sm font-medium text-primary hover:underline"
					>
						Add the first Telepastor
					</Link>
				) : null}
				{canImport ? (
					<Link
						href="/telepastors/import"
						className="inline-flex text-sm font-medium text-primary hover:underline"
					>
						Bulk import from Excel
					</Link>
				) : null}
			</div>
		</div>
	);
}
