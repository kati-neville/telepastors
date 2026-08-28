import { parseDateValue } from "@/lib/dates/format";
import type { BirthdayFilterValues } from "@/lib/validations/birthdays";
import type { BirthdayEntry } from "@/types/domain";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 (Jan – Mar)",
  2: "Q2 (Apr – Jun)",
  3: "Q3 (Jul – Sep)",
  4: "Q4 (Oct – Dec)",
};

export function getBirthdayMonth(dateOfBirth: string): number {
  const date = parseDateValue(dateOfBirth);
  return (date?.getMonth() ?? 0) + 1;
}

export function getBirthdayDay(dateOfBirth: string): number {
  const date = parseDateValue(dateOfBirth);
  return date?.getDate() ?? 1;
}

export function getQuarterFromMonth(month: number): number {
  return Math.ceil(month / 3);
}

export function matchesBirthdayFilter(
  dateOfBirth: string,
  filters: BirthdayFilterValues,
): boolean {
  if (filters.period === "all") {
    return true;
  }

  const month = getBirthdayMonth(dateOfBirth);

  if (filters.period === "month") {
    return month === filters.month;
  }

  return getQuarterFromMonth(month) === filters.quarter;
}

export function calculateAge(
  dateOfBirth: string,
  referenceDate = new Date(),
): number {
  const birth = parseDateValue(dateOfBirth);
  if (!birth) {
    return 0;
  }

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const birthdayThisYear = new Date(
    referenceDate.getFullYear(),
    birth.getMonth(),
    birth.getDate(),
  );

  if (referenceDate < birthdayThisYear) {
    age -= 1;
  }

  return age;
}

export function formatBirthdayDisplay(dateOfBirth: string): string {
  const date = parseDateValue(dateOfBirth);
  if (!date) {
    return dateOfBirth;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export function sortBirthdayEntries(entries: BirthdayEntry[]): BirthdayEntry[] {
  return [...entries].sort((left, right) => {
    const monthDiff = left.birthdayMonth - right.birthdayMonth;
    if (monthDiff !== 0) {
      return monthDiff;
    }

    const dayDiff = left.birthdayDay - right.birthdayDay;
    if (dayDiff !== 0) {
      return dayDiff;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getBirthdayFilterSummary(filters: BirthdayFilterValues): string {
  if (filters.period === "all") {
    return "All birthdays";
  }

  if (filters.period === "month" && filters.month) {
    return MONTH_NAMES[filters.month - 1] ?? "Selected month";
  }

  if (filters.period === "quarter" && filters.quarter) {
    return QUARTER_LABELS[filters.quarter] ?? "Selected quarter";
  }

  return "Birthdays";
}

export function isBirthdayToday(
  dateOfBirth: string,
  referenceDate = new Date(),
): boolean {
  const birth = parseDateValue(dateOfBirth);
  if (!birth) {
    return false;
  }

  return (
    birth.getMonth() === referenceDate.getMonth() &&
    birth.getDate() === referenceDate.getDate()
  );
}

export function formatBirthdayNames(names: string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0]!;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}
