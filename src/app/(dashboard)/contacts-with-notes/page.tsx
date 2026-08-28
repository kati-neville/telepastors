import { redirect } from "next/navigation";
import { canAccessCallQueue } from "@/lib/auth/calls";
import { canAccessContactsWithNotes } from "@/lib/auth/contacts-with-notes";
import { canAccessLeadershipReports } from "@/lib/auth/reports";
import { requireAuthSession } from "@/lib/auth/session";
import { ContactsWithNotesList } from "@/components/contacts/contacts-with-notes-list";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  fetchContactsWithNotes,
  fetchReportFilterOptions,
} from "@/lib/queries/reports";
import { reportFilterSchema } from "@/lib/validations/reports";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ContactsWithNotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ContactsWithNotesPage({
  searchParams,
}: ContactsWithNotesPageProps) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };
  const resolvedSearchParams = await searchParams;

  if (!canAccessContactsWithNotes(context)) {
    redirect("/dashboard");
  }

  const isLeadership = canAccessLeadershipReports(context);
  const filters = reportFilterSchema.parse({
    campaignId: getParam(resolvedSearchParams, "campaignId"),
    governorId: getParam(resolvedSearchParams, "governorId"),
    leaderId: getParam(resolvedSearchParams, "leaderId"),
    telepastorId: getParam(resolvedSearchParams, "telepastorId"),
    response: getParam(resolvedSearchParams, "response"),
    from: getParam(resolvedSearchParams, "from"),
    to: getParam(resolvedSearchParams, "to"),
    view: getParam(resolvedSearchParams, "view"),
    hasNotes: getParam(resolvedSearchParams, "hasNotes") === "true" ? "true" : undefined,
  });

  const [contacts, filterOptions] = await Promise.all([
    fetchContactsWithNotes(context, filters),
    isLeadership
      ? fetchReportFilterOptions(context, filters)
      : Promise.resolve(null),
  ]);

  const role = session.telepastor.role as "SUPER_ADMIN" | "GOVERNOR" | "LEADER";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Contacts with notes
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLeadership
            ? "Review call notes across your scope and call contacts directly."
            : "Contacts assigned to you that have call notes requiring follow-up."}
        </p>
      </div>

      {isLeadership && filterOptions ? (
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <ReportFilters
            filters={filters}
            options={filterOptions}
            role={role}
          />
        </Suspense>
      ) : null}

      <ContactsWithNotesList
        contacts={contacts}
        viewerId={session.telepastor.id}
        canUseCallQueue={canAccessCallQueue(context)}
      />
    </div>
  );
}
