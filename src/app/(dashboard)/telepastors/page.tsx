import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import {
  TelepastorsEmptyState,
  TelepastorsFilters,
} from "@/components/telepastors/telepastors-filters";
import { TelepastorMemberCards } from "@/components/telepastors/telepastor-member-cards";
import { TelepastorsTable } from "@/components/telepastors/telepastors-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { enforcePageAccess } from "@/lib/auth/guards";
import { canCreateTelepastor } from "@/lib/auth/permissions";
import { requireAuthSession } from "@/lib/auth/session";
import {
  fetchGovernorOptions,
  fetchLeaderOptions,
  fetchTelepastorsDirectory,
} from "@/lib/queries/telepastors";
import { telepastorsFilterSchema } from "@/lib/validations/telepastors";

type TelepastorsPageProps = {
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

async function TelepastorsDirectory({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAuthSession();
  const filters = telepastorsFilterSchema.parse({
    q: getParam(searchParams, "q"),
    role: getParam(searchParams, "role") ?? "ALL",
    governor: getParam(searchParams, "governor"),
    leader: getParam(searchParams, "leader"),
    status: getParam(searchParams, "status") ?? "all",
  });

  const [telepastors, governors, leaders] = await Promise.all([
    fetchTelepastorsDirectory(filters),
    session.telepastor.role === "SUPER_ADMIN"
      ? fetchGovernorOptions()
      : Promise.resolve([]),
    fetchLeaderOptions(
      session.telepastor.role === "GOVERNOR"
        ? session.telepastor.id
        : undefined,
    ),
  ]);

  const canCreate = canCreateTelepastor({ telepastor: session.telepastor });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Telepastors
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage ministry members, roles, and organizational placement.
          </p>
        </div>
        {canCreate ? (
          <Button render={<Link href="/telepastors/new" />}>
            <Plus />
            Add Telepastor
          </Button>
        ) : null}
      </div>

      <TelepastorsFilters
        viewerRole={session.telepastor.role}
        governors={governors}
        leaders={leaders}
      />

      {telepastors.length === 0 ? (
        <TelepastorsEmptyState canCreate={canCreate} />
      ) : (
        <>
          <TelepastorsTable telepastors={telepastors} />
          <TelepastorMemberCards telepastors={telepastors} />
        </>
      )}
    </div>
  );
}

export default async function TelepastorsPage({
  searchParams,
}: TelepastorsPageProps) {
  await enforcePageAccess("/telepastors");
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={<FiltersFallback />}>
      <TelepastorsDirectory searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
