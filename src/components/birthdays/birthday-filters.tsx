"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

  const monthItems = MONTH_NAMES.map((label, index) => ({
    value: String(index + 1),
    label,
  }));

  const quarterItems = Object.entries(QUARTER_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const updateFilters = (updates: Partial<BirthdayFilterValues>) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = { ...filters, ...updates };

    params.set("period", next.period);

    if (next.period === "month") {
      params.set("month", String(next.month ?? new Date().getMonth() + 1));
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
    const currentMonth = new Date().getMonth() + 1;
    router.replace(`${pathname}?period=month&month=${currentMonth}`);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">Filters</h3>
          <p className="text-sm text-muted-foreground">
            View birthdays by month, quarter, or show everyone who has shared
            their date of birth.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
          Reset
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterField label="View by">
          <Select
            value={filters.period}
            items={[...PERIOD_ITEMS]}
            onValueChange={(value) => {
              if (!value) return;
              if (value === "month") {
                updateFilters({
                  period: "month",
                  month: filters.month ?? new Date().getMonth() + 1,
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
              value={String(filters.month ?? new Date().getMonth() + 1)}
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
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
