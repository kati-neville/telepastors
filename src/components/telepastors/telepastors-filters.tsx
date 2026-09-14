"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
	FilterField,
	FiltersDialog,
} from "@/components/ui/filters-dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";

type TelepastorsFiltersProps = {
	viewerRole: MinistryRole;
	governors: TelepastorSummary[];
	leaders: TelepastorSummary[];
	className?: string;
};

export function TelepastorsFilters({
	viewerRole,
	governors,
	leaders,
	className,
}: TelepastorsFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const currentQuery = searchParams.get("q") ?? "";
	const currentRole = searchParams.get("role") ?? "ALL";
	const currentGovernor = searchParams.get("governor") ?? "ALL";
	const currentLeader = searchParams.get("leader") ?? "ALL";
	const currentStatus = searchParams.get("status") ?? "all";

	const activeCount = [
		Boolean(currentQuery.trim()),
		currentRole !== "ALL",
		viewerRole === "SUPER_ADMIN" && currentGovernor !== "ALL",
		(viewerRole === "SUPER_ADMIN" || viewerRole === "GOVERNOR") &&
			currentLeader !== "ALL",
		currentStatus !== "all",
	].filter(Boolean).length;

	const updateParams = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());

		if (!value || value === "ALL" || value === "all") {
			params.delete(key);
		} else {
			params.set(key, value);
		}

		router.replace(params.toString() ? `${pathname}?${params}` : pathname);
	};

	const clearFilters = () => {
		router.replace(pathname);
	};

	return (
		<FiltersDialog
			description="Search by name or phone, and narrow by role, team, or status."
			activeCount={activeCount}
			onClear={clearFilters}
			contentClassName="sm:max-w-xl"
			className={className}>
			<div className="grid gap-4 sm:grid-cols-2">
				<FilterField
					label="Search"
					htmlFor="telepastors-search"
					className="sm:col-span-2">
					<div className="relative px-1">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="telepastors-search"
							defaultValue={currentQuery}
							placeholder="Search by name or phone"
							className="pl-8"
							onChange={event => updateParams("q", event.target.value)}
						/>
					</div>
				</FilterField>

				<FilterField label="Role">
					<Select
						value={currentRole}
						onValueChange={value => updateParams("role", value ?? "ALL")}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All roles" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All</SelectItem>
							<SelectItem value="GOVERNOR">Governors</SelectItem>
							<SelectItem value="LEADER">Leaders</SelectItem>
							<SelectItem value="TELEPASTOR">Telepastors</SelectItem>
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Status">
					<Select
						value={currentStatus}
						onValueChange={value => updateParams("status", value ?? "all")}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
						</SelectContent>
					</Select>
				</FilterField>

				{viewerRole === "SUPER_ADMIN" ? (
					<FilterField label="Governor">
						<Select
							value={currentGovernor}
							onValueChange={value => updateParams("governor", value ?? "ALL")}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All governors" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All governors</SelectItem>
								{governors.map(governor => (
									<SelectItem key={governor.id} value={governor.id}>
										{governor.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>
				) : null}

				{viewerRole === "SUPER_ADMIN" || viewerRole === "GOVERNOR" ? (
					<FilterField label="Leader">
						<Select
							value={currentLeader}
							onValueChange={value => updateParams("leader", value ?? "ALL")}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All leaders" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All leaders</SelectItem>
								{leaders.map(leader => (
									<SelectItem key={leader.id} value={leader.id}>
										{leader.name}
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
						className="inline-flex text-sm font-medium text-primary hover:underline">
						Add the first Telepastor
					</Link>
				) : null}
				{canImport ? (
					<Link
						href="/telepastors/import"
						className="inline-flex text-sm font-medium text-primary hover:underline">
						Bulk import from Excel
					</Link>
				) : null}
			</div>
		</div>
	);
}
