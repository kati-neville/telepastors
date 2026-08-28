import { Suspense } from "react";
import { BirthdayFilters } from "@/components/birthdays/birthday-filters";
import { BirthdaysList } from "@/components/birthdays/birthdays-list";
import { Skeleton } from "@/components/ui/skeleton";
import { enforcePageAccess } from "@/lib/auth/guards";
import { requireAuthSession } from "@/lib/auth/session";
import { getBirthdayFilterSummary } from "@/lib/birthdays/view";
import {
  fetchBirthdays,
  getBirthdayScopeDescription,
} from "@/lib/queries/birthdays";
import { parseBirthdayFilters } from "@/lib/validations/birthdays";

type BirthdaysPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function FiltersFallback() {
  return <Skeleton className="h-36 w-full rounded-xl" />;
}

async function BirthdaysDirectory({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const filters = parseBirthdayFilters(searchParams, (key) =>
    getParam(searchParams, key),
  );
  const birthdays = await fetchBirthdays(context, filters);
  const summaryLabel = getBirthdayFilterSummary(filters);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Birthdays
        </h2>
        <p className="text-sm text-muted-foreground">
          {getBirthdayScopeDescription(context)}
        </p>
      </div>

      <Suspense fallback={<FiltersFallback />}>
        <BirthdayFilters filters={filters} />
      </Suspense>

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-semibold">{summaryLabel}</h3>
        <p className="text-sm text-muted-foreground">
          {birthdays.length}{" "}
          {birthdays.length === 1 ? "birthday" : "birthdays"}
        </p>
      </div>

      <BirthdaysList birthdays={birthdays} summaryLabel={summaryLabel} />
    </div>
  );
}

export default async function BirthdaysPage({ searchParams }: BirthdaysPageProps) {
  await enforcePageAccess("/birthdays");
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={<FiltersFallback />}>
      <BirthdaysDirectory searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
