import { isAfter, isBefore, startOfDay } from "date-fns";

export function parseDateValue(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateDisabled(
  date: Date,
  {
    fromDate,
    toDate,
  }: {
    fromDate?: Date;
    toDate?: Date;
  },
): boolean {
  const day = startOfDay(date);

  if (fromDate && isBefore(day, startOfDay(fromDate))) {
    return true;
  }

  if (toDate && isAfter(day, startOfDay(toDate))) {
    return true;
  }

  return false;
}
