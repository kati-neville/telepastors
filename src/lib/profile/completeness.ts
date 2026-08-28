import type { Telepastor } from "@/types/domain";

export type ProfileField = "address" | "date_of_birth" | "occupation" | "profile_picture_url";

const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  address: "location / address",
  date_of_birth: "date of birth",
  occupation: "occupation",
  profile_picture_url: "profile photo",
};

export function getMissingProfileFields(
  telepastor: Pick<
    Telepastor,
    "address" | "date_of_birth" | "occupation" | "profile_picture_url"
  >,
): ProfileField[] {
  const missing: ProfileField[] = [];

  if (!telepastor.address?.trim()) {
    missing.push("address");
  }

  if (!telepastor.date_of_birth) {
    missing.push("date_of_birth");
  }

  if (!telepastor.occupation?.trim()) {
    missing.push("occupation");
  }

  if (!telepastor.profile_picture_url) {
    missing.push("profile_picture_url");
  }

  return missing;
}

export function formatMissingProfileFields(fields: ProfileField[]): string {
  return fields.map((field) => PROFILE_FIELD_LABELS[field]).join(", ");
}

export function isProfileComplete(
  telepastor: Pick<
    Telepastor,
    "address" | "date_of_birth" | "occupation" | "profile_picture_url"
  >,
): boolean {
  return getMissingProfileFields(telepastor).length === 0;
}
