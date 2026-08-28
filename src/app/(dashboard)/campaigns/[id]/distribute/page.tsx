import { redirect } from "next/navigation";
import { requireCampaignDistributionAccess } from "@/app/actions/assignments";

type DistributePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignDistributePage({
  params,
}: DistributePageProps) {
  const { id } = await params;
  await requireCampaignDistributionAccess(id);
  redirect(`/assignments?campaign=${id}`);
}
