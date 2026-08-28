import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { BroadcastRecipientScope, CallResponse } from "@/types/domain";

export const BROADCAST_SCOPE_LABELS: Record<BroadcastRecipientScope, string> = {
  ALL_CONTACTS: "All contacts",
  CAMPAIGN: "One campaign",
  SELECTED_CONTACTS: "Selected contacts",
  GOVERNOR_ORG: "Governor organizations",
  LEADER_ORG: "Leader teams",
  TELEPASTOR_ASSIGNMENTS: "Telepastor assignments",
  RESPONSE_TYPE: "By response type",
};

export const BROADCAST_SCOPE_DESCRIPTIONS: Record<
  BroadcastRecipientScope,
  string
> = {
  ALL_CONTACTS: "Every contact across all campaigns",
  CAMPAIGN: "All contacts in one campaign",
  SELECTED_CONTACTS: "Pick specific contacts in a campaign",
  GOVERNOR_ORG: "All contacts assigned within governor organizations",
  LEADER_ORG: "All contacts assigned within leader teams",
  TELEPASTOR_ASSIGNMENTS: "All contacts assigned to telepastors",
  RESPONSE_TYPE: "Contacts filtered by latest call response",
};

type StoredScopeConfig = {
  governorId?: string | null;
  leaderId?: string | null;
  telepastorId?: string | null;
  response?: string | null;
  contactIds?: string[];
};

export function formatStoredScopeContext(
  scopeConfig: Record<string, unknown>,
  memberNames: Map<string, string>,
): string | null {
  const config = scopeConfig as StoredScopeConfig;
  const parts: string[] = [];

  if (config.governorId) {
    const name = memberNames.get(config.governorId);
    parts.push(name ? `Governor: ${name}` : "Governor organization");
  } else if ("scope" in scopeConfig && scopeConfig.scope === "GOVERNOR_ORG") {
    parts.push("All governor organizations");
  }

  if (config.leaderId) {
    const name = memberNames.get(config.leaderId);
    parts.push(name ? `Leader: ${name}` : "Leader organization");
  } else if ("scope" in scopeConfig && scopeConfig.scope === "LEADER_ORG") {
    parts.push("All leader teams");
  }

  if (config.telepastorId) {
    const name = memberNames.get(config.telepastorId);
    parts.push(name ? `Telepastor: ${name}` : "Telepastor assignments");
  } else if (
    "scope" in scopeConfig &&
    scopeConfig.scope === "TELEPASTOR_ASSIGNMENTS"
  ) {
    parts.push("All telepastors");
  }

  if (config.response) {
    const label =
      CALL_RESPONSE_LABELS[config.response as CallResponse] ?? config.response;
    parts.push(`Response: ${label}`);
  }

  if (config.contactIds?.length) {
    parts.push(`${config.contactIds.length} selected contact(s)`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
