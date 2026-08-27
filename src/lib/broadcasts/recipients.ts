import { createClient } from "@/lib/supabase/server";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import type { BroadcastComposerValues } from "@/lib/validations/broadcasts";
import type { CallResponse, TelepastorSummary } from "@/types/domain";

export type BroadcastRecipient = {
  id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  campaign_id: string;
  campaign_name: string;
};

async function fetchMembers(): Promise<TelepastorSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("id, name, role, governor_id, leader_id, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

function getOrgMemberIds(
  members: TelepastorSummary[],
  rootMemberId: string,
  mode: "GOVERNOR_ORG" | "LEADER_ORG",
) {
  const memberById = new Map(members.map((member) => [member.id, member]));

  if (mode === "LEADER_ORG") {
    return members
      .filter(
        (member) =>
          member.id === rootMemberId ||
          (member.role === "TELEPASTOR" && member.leader_id === rootMemberId),
      )
      .map((member) => member.id);
  }

  return members
    .filter((member) => {
      if (member.id === rootMemberId) return true;
      if (member.role === "LEADER" && member.governor_id === rootMemberId) {
        return true;
      }
      if (member.role === "TELEPASTOR") {
        const leader = member.leader_id
          ? memberById.get(member.leader_id)
          : null;
        return getGovernorIdForTelepastor(member, leader) === rootMemberId;
      }
      return false;
    })
    .map((member) => member.id);
}

async function enrichContacts(
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    phone_normalized: string;
    campaign_id: string;
  }>,
): Promise<BroadcastRecipient[]> {
  if (contacts.length === 0) return [];

  const supabase = await createClient();
  const campaignIds = [...new Set(contacts.map((contact) => contact.campaign_id))];
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .in("id", campaignIds);

  const campaignMap = new Map(
    (campaigns ?? []).map((campaign) => [campaign.id, campaign.name]),
  );

  return contacts.map((contact) => ({
    ...contact,
    campaign_name: campaignMap.get(contact.campaign_id) ?? "Unknown campaign",
  }));
}

export async function resolveBroadcastRecipients(
  input: BroadcastComposerValues,
): Promise<BroadcastRecipient[]> {
  const supabase = await createClient();
  const members = await fetchMembers();

  let query = supabase
    .from("contacts")
    .select("id, name, phone, phone_normalized, campaign_id, current_assignee_id, latest_response");

  switch (input.scope) {
    case "CAMPAIGN":
      query = query.eq("campaign_id", input.campaignId!);
      break;
    case "SELECTED_CONTACTS":
      query = query
        .eq("campaign_id", input.campaignId!)
        .in("id", input.contactIds ?? []);
      break;
    case "GOVERNOR_ORG": {
      const assigneeIds = getOrgMemberIds(
        members,
        input.governorId!,
        "GOVERNOR_ORG",
      );
      if (assigneeIds.length === 0) return [];
      query = query.in("current_assignee_id", assigneeIds);
      if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
      break;
    }
    case "LEADER_ORG": {
      const assigneeIds = getOrgMemberIds(
        members,
        input.leaderId!,
        "LEADER_ORG",
      );
      if (assigneeIds.length === 0) return [];
      query = query.in("current_assignee_id", assigneeIds);
      if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
      break;
    }
    case "TELEPASTOR_ASSIGNMENTS":
      query = query.eq("current_assignee_id", input.telepastorId!);
      if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
      break;
    case "RESPONSE_TYPE":
      query = query
        .eq("campaign_id", input.campaignId!)
        .eq("latest_response", input.response as CallResponse);
      break;
  }

  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);

  const uniqueByPhone = new Map<string, BroadcastRecipient>();
  const enriched = await enrichContacts(data ?? []);

  for (const contact of enriched) {
    if (!uniqueByPhone.has(contact.phone_normalized)) {
      uniqueByPhone.set(contact.phone_normalized, contact);
    }
  }

  return [...uniqueByPhone.values()];
}

export async function fetchCampaignContactOptions(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, phone, phone_normalized, campaign_id")
    .eq("campaign_id", campaignId)
    .order("name");

  if (error) throw new Error(error.message);
  return enrichContacts(data ?? []);
}

export async function fetchBroadcastFormOptions() {
  const supabase = await createClient();
  const members = await fetchMembers();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return {
    campaigns: campaigns ?? [],
    governors: members.filter((member) => member.role === "GOVERNOR"),
    leaders: members.filter((member) => member.role === "LEADER"),
    telepastors: members.filter((member) => member.role === "TELEPASTOR"),
  };
}
