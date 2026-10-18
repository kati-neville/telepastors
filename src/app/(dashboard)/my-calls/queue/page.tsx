import { requireCallQueueAccess } from "@/app/actions/calls";
import { CallQueuePanel } from "@/components/calls/call-queue-panel";
import { fetchActiveWhatsAppTemplates } from "@/lib/queries/broadcasts";
import {
  fetchCallQueueContact,
  fetchCallQueueStats,
  fetchNextQueueContacts,
} from "@/lib/queries/calls";
import type { CallQueueContact } from "@/types/domain";

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

  const [stats, initialContacts, whatsAppTemplates] = await Promise.all([
    fetchCallQueueStats(),
    loadQueueWindow(context, { contactId, campaignId }),
    fetchActiveWhatsAppTemplates(),
  ]);

  const defaultTemplateId =
    whatsAppTemplates.find((template) => template.is_default)?.id ??
    whatsAppTemplates[0]?.id ??
    null;

  return (
    <CallQueuePanel
      initialContacts={initialContacts}
      stats={stats}
      campaignId={campaignId}
      whatsAppTemplates={whatsAppTemplates}
      defaultTemplateId={defaultTemplateId}
    />
  );
}

async function loadQueueWindow(
  context: Parameters<typeof fetchNextQueueContacts>[0],
  options: { contactId?: string; campaignId?: string },
): Promise<CallQueueContact[]> {
  if (!options.contactId) {
    return fetchNextQueueContacts(context, {
      campaignId: options.campaignId,
      limit: 3,
    });
  }

  const [current, upcoming] = await Promise.all([
    fetchCallQueueContact(context, options.contactId),
    fetchNextQueueContacts(context, {
      campaignId: options.campaignId,
      skipContactIds: [options.contactId],
      limit: 2,
    }),
  ]);

  if (!current) {
    return upcoming;
  }

  return [
    current,
    ...upcoming.filter((contact) => contact.id !== current.id),
  ];
}
