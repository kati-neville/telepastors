"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	FilterField,
	FiltersDialog,
} from "@/components/ui/filters-dialog";
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

type ReportFiltersProps = {
	filters: ReportFilterValues;
	options: ReportFilterOptions;
	role: "SUPER_ADMIN" | "GOVERNOR" | "LEADER";
};

export function ReportFilters({ filters, options, role }: ReportFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const activeCount = [
		Boolean(filters.campaignId),
		role === "SUPER_ADMIN" && Boolean(filters.governorId),
		(role === "SUPER_ADMIN" || role === "GOVERNOR") && Boolean(filters.leaderId),
		Boolean(filters.telepastorId),
		Boolean(filters.response),
		Boolean(filters.from),
		Boolean(filters.to),
		filters.hasNotes === "true",
	].filter(Boolean).length;

	const updateFilters = (updates: Partial<ReportFilterValues>) => {
		const params = new URLSearchParams(searchParams.toString());

		for (const [key, value] of Object.entries(updates)) {
			if (!value) {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}

		router.replace(params.toString() ? `${pathname}?${params}` : pathname);
	};

	const clearFilters = () => {
		router.replace(pathname);
	};

	return (
		<div className="flex justify-end">
			<FiltersDialog
				description="Narrow results by campaign, team, response, or date."
				activeCount={activeCount}
				onClear={clearFilters}
				contentClassName="sm:max-w-2xl"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<FilterField label="Campaign">
						<Select
							value={filters.campaignId ?? ""}
							onValueChange={(value) =>
								updateFilters({ campaignId: value || undefined })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All campaigns" />
							</SelectTrigger>
							<SelectContent>
								{options.campaigns.map((campaign) => (
									<SelectItem key={campaign.id} value={campaign.id}>
										{campaign.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					{role === "SUPER_ADMIN" ? (
						<FilterField label="Governor">
							<Select
								value={filters.governorId ?? ""}
								onValueChange={(value) =>
									updateFilters({
										governorId: value || undefined,
										leaderId: undefined,
										telepastorId: undefined,
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="All governors" />
								</SelectTrigger>
								<SelectContent>
									{options.governors.map((governor) => (
										<SelectItem key={governor.id} value={governor.id}>
											{governor.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					{role === "SUPER_ADMIN" || role === "GOVERNOR" ? (
						<FilterField label="Leader">
							<Select
								value={filters.leaderId ?? ""}
								onValueChange={(value) =>
									updateFilters({
										leaderId: value || undefined,
										telepastorId: undefined,
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="All leaders" />
								</SelectTrigger>
								<SelectContent>
									{options.leaders.map((leader) => (
										<SelectItem key={leader.id} value={leader.id}>
											{leader.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					<FilterField label="Telepastor">
						<Select
							value={filters.telepastorId ?? ""}
							onValueChange={(value) =>
								updateFilters({ telepastorId: value || undefined })
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All telepastors" />
							</SelectTrigger>
							<SelectContent>
								{options.telepastors.map((telepastor) => (
									<SelectItem key={telepastor.id} value={telepastor.id}>
										{telepastor.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					<FilterField label="Response">
						<Select
							value={filters.response ?? ""}
							onValueChange={(value) =>
								updateFilters({
									response:
										(value as ReportFilterValues["response"]) || undefined,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All responses" />
							</SelectTrigger>
							<SelectContent>
								{CALL_RESPONSES.map((response) => (
									<SelectItem key={response} value={response}>
										{CALL_RESPONSE_LABELS[response]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					<FilterField label="From">
						<DatePicker
							value={filters.from?.slice(0, 10) ?? ""}
							onChange={(value) =>
								updateFilters({
									from: value ? `${value}T00:00:00.000Z` : undefined,
								})
							}
							placeholder="Select start date"
						/>
					</FilterField>

					<FilterField label="To">
						<DatePicker
							value={filters.to?.slice(0, 10) ?? ""}
							onChange={(value) =>
								updateFilters({
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
								checked={filters.hasNotes === "true"}
								onCheckedChange={(checked) =>
									updateFilters({ hasNotes: checked ? "true" : undefined })
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
