import { requireWhatsAppTemplatesAccess } from "@/app/actions/whatsapp-templates";
import { WhatsAppTemplatesManager } from "@/components/broadcasts/whatsapp-templates-manager";
import { fetchWhatsAppTemplates } from "@/lib/queries/broadcasts";

export default async function WhatsAppTemplatesPage() {
  await requireWhatsAppTemplatesAccess();
  const templates = await fetchWhatsAppTemplates();

  return <WhatsAppTemplatesManager templates={templates} canManage />;
}
