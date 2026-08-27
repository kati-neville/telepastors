import { formatStoredScopeContext } from "@/lib/broadcasts/labels";
import { createClient } from "@/lib/supabase/server";
import type {
  BroadcastRecipientScope,
  SmsBroadcast,
  SmsBroadcastDetail,
  SmsBroadcastSummary,
  WhatsAppMessageTemplate,
} from "@/types/domain";

export async function fetchSmsBroadcasts(): Promise<SmsBroadcastSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sms_broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const broadcasts = data ?? [];
  const creatorIds = [
    ...new Set(
      broadcasts
        .map((broadcast) => broadcast.created_by)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const campaignIds = [
    ...new Set(
      broadcasts
        .map((broadcast) => broadcast.campaign_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [{ data: creators }, { data: campaigns }] = await Promise.all([
    creatorIds.length
      ? supabase.from("telepastors").select("id, name").in("id", creatorIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
      : Promise.resolve({ data: [] }),
  ]);

  const creatorMap = new Map(
    (creators ?? []).map((creator) => [creator.id, creator.name]),
  );
  const campaignMap = new Map(
    (campaigns ?? []).map((campaign) => [campaign.id, campaign.name]),
  );

  return broadcasts.map((broadcast) => ({
    ...(broadcast as SmsBroadcast),
    created_by_name: broadcast.created_by
      ? (creatorMap.get(broadcast.created_by) ?? null)
      : null,
    campaign_name: broadcast.campaign_id
      ? (campaignMap.get(broadcast.campaign_id) ?? null)
      : null,
  }));
}

export async function fetchSmsBroadcastById(
  id: string,
): Promise<SmsBroadcastDetail | null> {
  const supabase = await createClient();

  const { data: broadcast, error } = await supabase
    .from("sms_broadcasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!broadcast) return null;

  const { data: recipients, error: recipientsError } = await supabase
    .from("sms_broadcast_recipients")
    .select("*")
    .eq("broadcast_id", id)
    .order("contact_name");

  if (recipientsError) throw new Error(recipientsError.message);

  const [creator, campaign] = await Promise.all([
    broadcast.created_by
      ? supabase
          .from("telepastors")
          .select("name")
          .eq("id", broadcast.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    broadcast.campaign_id
      ? supabase
          .from("campaigns")
          .select("name")
          .eq("id", broadcast.campaign_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const scopeConfig = (broadcast.scope_config ?? {}) as Record<string, unknown>;
  const memberIds = [
    scopeConfig.governorId,
    scopeConfig.leaderId,
    scopeConfig.telepastorId,
  ].filter((value): value is string => typeof value === "string");

  const { data: scopeMembers } = memberIds.length
    ? await supabase.from("telepastors").select("id, name").in("id", memberIds)
    : { data: [] };

  const memberNames = new Map(
    (scopeMembers ?? []).map((member) => [member.id, member.name]),
  );

  return {
    ...(broadcast as SmsBroadcast),
    created_by_name: creator.data?.name ?? null,
    campaign_name: campaign.data?.name ?? null,
    scope_context_label: formatStoredScopeContext(scopeConfig, memberNames),
    recipients: recipients ?? [],
  };
}

export async function fetchWhatsAppTemplates(): Promise<WhatsAppMessageTemplate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_message_templates")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as WhatsAppMessageTemplate[];
}

export async function fetchActiveWhatsAppTemplates(): Promise<
  WhatsAppMessageTemplate[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_message_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as WhatsAppMessageTemplate[];
}

export async function fetchDefaultWhatsAppTemplate(): Promise<WhatsAppMessageTemplate | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_message_templates")
    .select("*")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data as WhatsAppMessageTemplate;

  const { data: fallback } = await supabase
    .from("whatsapp_message_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return (fallback as WhatsAppMessageTemplate | null) ?? null;
}

export function buildScopeConfig(input: {
  scope: BroadcastRecipientScope;
  campaignId?: string;
  governorId?: string;
  leaderId?: string;
  telepastorId?: string;
  response?: string;
  contactIds?: string[];
}) {
  return {
    scope: input.scope,
    campaignId: input.campaignId ?? null,
    governorId: input.governorId ?? null,
    leaderId: input.leaderId ?? null,
    telepastorId: input.telepastorId ?? null,
    response: input.response ?? null,
    contactIds: input.contactIds ?? [],
  };
}
