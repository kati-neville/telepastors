import type { CampaignStatus } from "@/types/domain";

export function getCampaignStatusLabel(status: CampaignStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "COMPLETED":
      return "Completed";
    case "ARCHIVED":
      return "Archived";
  }
}

export function formatCampaignDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
