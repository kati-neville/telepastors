"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterField, FiltersDialog } from "@/components/ui/filters-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { CALL_RESPONSES } from "@/types/domain";
import type { ReportFilterOptions } from "@/types/domain";
import type { ReportFilterValues } from "@/lib/validations/reports";
import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";

const ALL_VALUE = "__all__";

type ReportFiltersProps = {
	filters: ReportFilterValues;
	options: ReportFilterOptions;
	role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER";
};

function countActiveFilters(
	filters: ReportFilterValues,
	role: ReportFiltersProps["role"],
) {
	return [
		Boolean(filters.campaignId),
		role === "SUPER_ADMIN" && Boolean(filters.governorId),
		(role === "SUPER_ADMIN" || role === "GOVERNOR") &&
			Boolean(filters.leaderId),
		Boolean(filters.telepastorId),
		Boolean(filters.response),
		Boolean(filters.from),
		Boolean(filters.to),
		filters.hasNotes === "true",
	].filter(Boolean).length;
}

function toSelectValue(value: string | undefined) {
	return value || ALL_VALUE;
}

function fromSelectValue(value: string | null | undefined) {
	if (!value || value === ALL_VALUE) {
		return undefined;
	}
	return value;
}

export function ReportFilters({ filters, options, role }: ReportFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<ReportFilterValues>(filters);

	const appliedCount = countActiveFilters(filters, role);
	const draftCount = countActiveFilters(draft, role);

	const campaignItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All campaigns" },
			...options.campaigns.map(campaign => ({
				value: campaign.id,
				label: campaign.name,
			})),
		],
		[options.campaigns],
	);

	const governorItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All governors" },
			...options.governors.map(governor => ({
				value: governor.id,
				label: governor.name,
			})),
		],
		[options.governors],
	);

	const leaderItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All leaders" },
			...options.leaders.map(leader => ({
				value: leader.id,
				label: leader.name,
			})),
		],
		[options.leaders],
	);

	const telepastorItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All telepastors" },
			...options.telepastors.map(telepastor => ({
				value: telepastor.id,
				label: telepastor.name,
			})),
		],
		[options.telepastors],
	);

	const responseItems = useMemo(
		() => [
			{ value: ALL_VALUE, label: "All responses" },
			...CALL_RESPONSES.map(response => ({
				value: response,
				label: CALL_RESPONSE_LABELS[response],
			})),
		],
		[],
	);

	const updateDraft = (updates: Partial<ReportFilterValues>) => {
		setDraft(current => ({ ...current, ...updates }));
	};

	const applyFilters = (next: ReportFilterValues) => {
		const params = new URLSearchParams();

		if (next.campaignId) params.set("campaignId", next.campaignId);
		if (next.governorId) params.set("governorId", next.governorId);
		if (next.leaderId) params.set("leaderId", next.leaderId);
		if (next.telepastorId) params.set("telepastorId", next.telepastorId);
		if (next.response) params.set("response", next.response);
		if (next.from) params.set("from", next.from);
		if (next.to) params.set("to", next.to);
		if (next.hasNotes === "true") params.set("hasNotes", "true");
		if (next.view) params.set("view", next.view);

		router.replace(params.toString() ? `${pathname}?${params}` : pathname);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(filters);
		}
		setOpen(nextOpen);
	};

	const clearDraft = () => {
		setDraft({
			view: draft.view,
		});
	};

	return (
		<div className="flex justify-end">
			<FiltersDialog
				description="Narrow results by campaign, team, response, or date."
				activeCount={appliedCount}
				clearDisabled={draftCount === 0}
				onClear={clearDraft}
				onDone={() => applyFilters(draft)}
				open={open}
				onOpenChange={handleOpenChange}
				contentClassName="sm:max-w-2xl">
				<div className="grid gap-4 sm:grid-cols-2">
					<FilterField label="Campaign">
						<Select
							value={toSelectValue(draft.campaignId)}
							items={campaignItems}
							onValueChange={value =>
								updateDraft({ campaignId: fromSelectValue(value) })
							}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All campaigns" />
							</SelectTrigger>
							<SelectContent>
								{campaignItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					{role === "SUPER_ADMIN" ? (
						<FilterField label="Governor">
							<Select
								value={toSelectValue(draft.governorId)}
								items={governorItems}
								onValueChange={value =>
									updateDraft({
										governorId: fromSelectValue(value),
										leaderId: undefined,
										telepastorId: undefined,
									})
								}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="All governors" />
								</SelectTrigger>
								<SelectContent>
									{governorItems.map(item => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					{role === "SUPER_ADMIN" || role === "GOVERNOR" ? (
						<FilterField label="Leader">
							<Select
								value={toSelectValue(draft.leaderId)}
								items={leaderItems}
								onValueChange={value =>
									updateDraft({
										leaderId: fromSelectValue(value),
										telepastorId: undefined,
									})
								}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="All leaders" />
								</SelectTrigger>
								<SelectContent>
									{leaderItems.map(item => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					<FilterField label="Telepastor">
						<Select
							value={toSelectValue(draft.telepastorId)}
							items={telepastorItems}
							onValueChange={value =>
								updateDraft({ telepastorId: fromSelectValue(value) })
							}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All telepastors" />
							</SelectTrigger>
							<SelectContent>
								{telepastorItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					<FilterField label="Response">
						<Select
							value={toSelectValue(draft.response)}
							items={responseItems}
							onValueChange={value =>
								updateDraft({
									response: fromSelectValue(
										value,
									) as ReportFilterValues["response"],
								})
							}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All responses" />
							</SelectTrigger>
							<SelectContent>
								{responseItems.map(item => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					<FilterField label="From">
						<DatePicker
							value={draft.from?.slice(0, 10) ?? ""}
							onChange={value =>
								updateDraft({
									from: value ? `${value}T00:00:00.000Z` : undefined,
								})
							}
							placeholder="Select start date"
						/>
					</FilterField>

					<FilterField label="To">
						<DatePicker
							value={draft.to?.slice(0, 10) ?? ""}
							onChange={value =>
								updateDraft({
									to: value ? `${value}T23:59:59.999Z` : undefined,
								})
							}
							placeholder="Select end date"
						/>
					</FilterField>

					<FilterField label="Has notes" className="sm:col-span-2">
						<div className="flex min-h-9 items-center gap-3 rounded-md border px-3">
							<Switch
								id="has-notes-filter"
								checked={draft.hasNotes === "true"}
								onCheckedChange={checked =>
									updateDraft({ hasNotes: checked ? "true" : undefined })
								}
							/>
							<Label htmlFor="has-notes-filter" className="font-normal">
								Only show activity with notes
							</Label>
						</div>
					</FilterField>
				</div>
			</FiltersDialog>
		</div>
	);
}
