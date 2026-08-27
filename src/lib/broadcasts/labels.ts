import { CALL_RESPONSE_LABELS } from "@/lib/config/calling";
import type { BroadcastRecipientScope, CallResponse } from "@/types/domain";

export const BROADCAST_SCOPE_LABELS: Record<BroadcastRecipientScope, string> = {
  CAMPAIGN: "Campaign",
  SELECTED_CONTACTS: "Selected contacts",
  GOVERNOR_ORG: "Governor org",
  LEADER_ORG: "Leader org",
  TELEPASTOR_ASSIGNMENTS: "Telepastor",
  RESPONSE_TYPE: "Response type",
};

export const BROADCAST_SCOPE_DESCRIPTIONS: Record<
  BroadcastRecipientScope,
  string
> = {
  CAMPAIGN: "Entire campaign",
  SELECTED_CONTACTS: "Selected contacts",
  GOVERNOR_ORG: "Governor organization",
  LEADER_ORG: "Leader organization",
  TELEPASTOR_ASSIGNMENTS: "Telepastor assignments",
  RESPONSE_TYPE: "Response type",
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
  }

  if (config.leaderId) {
    const name = memberNames.get(config.leaderId);
    parts.push(name ? `Leader: ${name}` : "Leader organization");
  }

  if (config.telepastorId) {
    const name = memberNames.get(config.telepastorId);
    parts.push(name ? `Telepastor: ${name}` : "Telepastor assignments");
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
