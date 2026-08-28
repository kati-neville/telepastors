import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignDetail } from "@/types/domain";

export async function fetchCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function fetchCampaignById(id: string): Promise<CampaignDetail | null> {
  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!campaign) {
    return null;
  }

  const [
    { count: contactCount },
    { count: importCount },
    { data: creator },
    { data: latestImport },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id),
    supabase
      .from("contact_imports")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "COMPLETED"),
    campaign.created_by
      ? supabase
          .from("telepastors")
          .select("name")
          .eq("id", campaign.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("contact_imports")
      .select("created_at")
      .eq("campaign_id", id)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...campaign,
    created_by_name: creator?.name ?? null,
    contact_count: contactCount ?? 0,
    import_count: importCount ?? 0,
    latest_import_at: latestImport?.created_at ?? null,
  };
}

export async function fetchCampaignSummaries(): Promise<
  Array<Campaign & { contact_count: number }>
> {
  const supabase = await createClient();
  const campaigns = await fetchCampaigns();

  if (campaigns.length === 0) {
    return [];
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const counts = await Promise.all(
    campaignIds.map(async (campaignId) => {
      const { count, error } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);

      if (error) {
        throw new Error(error.message);
      }

      return [campaignId, count ?? 0] as const;
    }),
  );

  const countMap = new Map(counts);

  return campaigns.map((campaign) => ({
    ...campaign,
    contact_count: countMap.get(campaign.id) ?? 0,
  }));
}
