"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	FilterField,
	FiltersDialog,
} from "@/components/ui/filters-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES, QUARTER_LABELS } from "@/lib/birthdays/view";
import type { BirthdayFilterValues } from "@/lib/validations/birthdays";

const PERIOD_ITEMS = [
	{ value: "month", label: "By month" },
	{ value: "quarter", label: "By quarter" },
	{ value: "all", label: "All birthdays" },
] as const;

const ROLE_ITEMS = [
	{ value: "ALL", label: "All roles" },
	{ value: "GOVERNOR", label: "Governors" },
	{ value: "LEADER", label: "Leaders" },
	{ value: "TELEPASTOR", label: "Telepastors" },
] as const;

type BirthdayFiltersProps = {
	filters: BirthdayFilterValues;
};

export function BirthdayFilters({ filters }: BirthdayFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentMonth = new Date().getMonth() + 1;

	const monthItems = MONTH_NAMES.map((label, index) => ({
		value: String(index + 1),
		label,
	}));

	const quarterItems = Object.entries(QUARTER_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	const activeCount = [
		filters.period !== "month",
		filters.period === "month" &&
			filters.month != null &&
			filters.month !== currentMonth,
		filters.period === "quarter",
		filters.role !== "ALL",
	].filter(Boolean).length;

	const updateFilters = (updates: Partial<BirthdayFilterValues>) => {
		const params = new URLSearchParams(searchParams.toString());
		const next = { ...filters, ...updates };

		params.set("period", next.period);

		if (next.period === "month") {
			params.set("month", String(next.month ?? currentMonth));
			params.delete("quarter");
		} else if (next.period === "quarter") {
			params.set("quarter", String(next.quarter ?? 1));
			params.delete("month");
		} else {
			params.delete("month");
			params.delete("quarter");
		}

		if (next.role && next.role !== "ALL") {
			params.set("role", next.role);
		} else {
			params.delete("role");
		}

		router.replace(`${pathname}?${params.toString()}`);
	};

	const clearFilters = () => {
		router.replace(`${pathname}?period=month&month=${currentMonth}`);
	};

	return (
		<div className="flex justify-end">
			<FiltersDialog
				description="View birthdays by month, quarter, or show everyone who has shared their date of birth."
				activeCount={activeCount}
				onClear={clearFilters}
				clearLabel="Reset"
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<FilterField label="View by">
						<Select
							value={filters.period}
							items={[...PERIOD_ITEMS]}
							onValueChange={(value) => {
								if (!value) return;
								if (value === "month") {
									updateFilters({
										period: "month",
										month: filters.month ?? currentMonth,
									});
									return;
								}
								if (value === "quarter") {
									updateFilters({
										period: "quarter",
										quarter: filters.quarter ?? 1,
									});
									return;
								}
								updateFilters({ period: "all" });
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select view" />
							</SelectTrigger>
							<SelectContent>
								{PERIOD_ITEMS.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FilterField>

					{filters.period === "month" ? (
						<FilterField label="Month">
							<Select
								value={String(filters.month ?? currentMonth)}
								items={monthItems}
								onValueChange={(value) => {
									if (!value) return;
									updateFilters({ month: Number(value) });
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select month" />
								</SelectTrigger>
								<SelectContent>
									{monthItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					{filters.period === "quarter" ? (
						<FilterField label="Quarter">
							<Select
								value={String(filters.quarter ?? 1)}
								items={quarterItems}
								onValueChange={(value) => {
									if (!value) return;
									updateFilters({ quarter: Number(value) });
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select quarter" />
								</SelectTrigger>
								<SelectContent>
									{quarterItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FilterField>
					) : null}

					<FilterField label="Role">
						<Select
							value={filters.role}
							items={[...ROLE_ITEMS]}
							onValueChange={(value) => {
								if (!value) return;
								updateFilters({
									role: value as BirthdayFilterValues["role"],
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
				</div>
			</FiltersDialog>
		</div>
	);
}
