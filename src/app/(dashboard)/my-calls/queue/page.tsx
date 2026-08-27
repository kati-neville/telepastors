import { requireCallQueueAccess } from "@/app/actions/calls";
import { CallQueuePanel } from "@/components/calls/call-queue-panel";
import {
  fetchActiveWhatsAppTemplates,
  fetchDefaultWhatsAppTemplate,
} from "@/lib/queries/broadcasts";
import {
  fetchAssignedContacts,
  fetchCallQueueContact,
  fetchCallQueueStats,
  fetchNextQueueContact,
} from "@/lib/queries/calls";

type CallQueuePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function CallQueuePage({ searchParams }: CallQueuePageProps) {
  const resolvedSearchParams = await searchParams;
  const { context } = await requireCallQueueAccess();

  const contactId = getParam(resolvedSearchParams, "contactId");
  const campaignId = getParam(resolvedSearchParams, "campaignId");

  const [stats, allContacts, initialContact, whatsAppTemplates, defaultTemplate] =
    await Promise.all([
      fetchCallQueueStats(context),
      fetchAssignedContacts(context, { campaignId }),
      contactId
        ? fetchCallQueueContact(context, contactId)
        : fetchNextQueueContact(context, { campaignId }),
      fetchActiveWhatsAppTemplates(),
      fetchDefaultWhatsAppTemplate(),
    ]);

  return (
    <CallQueuePanel
      key={initialContact?.id ?? "queue-complete"}
      initialContact={initialContact}
      allContacts={allContacts}
      stats={stats}
      whatsAppTemplates={whatsAppTemplates}
      defaultTemplateId={defaultTemplate?.id ?? null}
    />
  );
}
