import { requireMyCallsAccess } from "@/app/actions/calls";
import { AssignedContactsPageClient } from "@/components/calls/assigned-contacts-page-client";
import { fetchAssignedContacts } from "@/lib/queries/calls";

export default async function MyCallsListPage() {
  const { context } = await requireMyCallsAccess();
  const contacts = await fetchAssignedContacts(context);

  return <AssignedContactsPageClient contacts={contacts} />;
}
