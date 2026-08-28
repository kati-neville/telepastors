import {
  canManageWhatsAppTemplates,
  canSendSmsBroadcasts,
  canViewWhatsAppTemplates,
} from "@/lib/auth/broadcasts";
import { formatStoredScopeContext } from "@/lib/broadcasts/labels";
import { buildScopeConfig } from "@/lib/queries/broadcasts";
import { getConfiguredProviderName, getSmsProvider } from "@/lib/sms/get-provider";
import {
  buildMessagePreview,
  estimateSmsUnits,
  personalizeBroadcastMessage,
} from "@/lib/sms/message-utils";
import { SmsProviderNotConfiguredError } from "@/lib/sms/types";
import { UnconfiguredSmsProvider } from "@/lib/sms/unconfigured-provider";
import { broadcastComposerSchema } from "@/lib/validations/broadcasts";
import type { Telepastor } from "@/types/domain";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTelepastor(
  overrides: Partial<Telepastor> & Pick<Telepastor, "id" | "role">,
): Telepastor {
  return {
    auth_user_id: null,
    name: overrides.name ?? "Test User",
    phone: "+233000000000",
    phone_normalized: null,
    address: null,
    profile_picture_url: null,
    date_of_birth: null,
    occupation: null,
    is_active: true,
    must_change_password: false,
    leader_id: null,
    governor_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function testBroadcastPermissions() {
  const superAdmin = makeTelepastor({ id: "sa", role: "SUPER_ADMIN" });
  const governor = makeTelepastor({ id: "gov", role: "GOVERNOR" });
  const leader = makeTelepastor({ id: "lead", role: "LEADER" });
  const telepastor = makeTelepastor({ id: "tp", role: "TELEPASTOR" });

  assert(
    canSendSmsBroadcasts({ telepastor: superAdmin }),
    "Super admin can send broadcasts",
  );
  assert(
    !canSendSmsBroadcasts({ telepastor: governor }),
    "Governor cannot send broadcasts",
  );
  assert(
    !canSendSmsBroadcasts({ telepastor: leader }),
    "Leader cannot send broadcasts",
  );
  assert(
    !canSendSmsBroadcasts({ telepastor: telepastor }),
    "Telepastor cannot send broadcasts",
  );

  assert(
    canManageWhatsAppTemplates({ telepastor: superAdmin }),
    "Super admin manages templates",
  );
  assert(
    canManageWhatsAppTemplates({ telepastor: leader }),
    "Leader manages templates",
  );
  assert(
    !canManageWhatsAppTemplates({ telepastor: telepastor }),
    "Telepastor cannot manage templates",
  );
  assert(
    canViewWhatsAppTemplates({ telepastor: telepastor }),
    "Telepastor can view templates",
  );
}

function testRecipientSelectionValidation() {
  const campaignId = "11111111-1111-4111-8111-111111111111";
  const contactId = "22222222-2222-4222-8222-222222222222";
  const governorId = "33333333-3333-4333-8333-333333333333";

  const campaignResult = broadcastComposerSchema.safeParse({
    message: "Hello {name}",
    scope: "CAMPAIGN",
    campaignId,
  });
  assert(campaignResult.success, "Campaign scope validates with campaign");

  const missingCampaign = broadcastComposerSchema.safeParse({
    message: "Hello",
    scope: "CAMPAIGN",
  });
  assert(!missingCampaign.success, "Campaign scope requires campaign");

  const selectedContacts = broadcastComposerSchema.safeParse({
    message: "Hello",
    scope: "SELECTED_CONTACTS",
    campaignId,
    contactIds: [contactId],
  });
  assert(selectedContacts.success, "Selected contacts validates");

  const missingContacts = broadcastComposerSchema.safeParse({
    message: "Hello",
    scope: "SELECTED_CONTACTS",
    campaignId,
    contactIds: [],
  });
  assert(!missingContacts.success, "Selected contacts requires at least one");

  const governorOrg = broadcastComposerSchema.safeParse({
    message: "Hello",
    scope: "GOVERNOR_ORG",
    governorId,
  });
  assert(governorOrg.success, "Governor org validates");

  const responseType = broadcastComposerSchema.safeParse({
    message: "Hello",
    scope: "RESPONSE_TYPE",
    campaignId,
    response: "COMING",
  });
  assert(responseType.success, "Response type validates");
}

function testMessagePreviewAndUnits() {
  const message = "Hi {name}, see you at {campaign}.";
  const preview = buildMessagePreview(message, {
    name: "Ama",
    campaignName: "Sunday Service",
  });
  assert(preview.includes("Ama"), "Preview personalizes name");
  assert(preview.includes("Sunday Service"), "Preview personalizes campaign");

  const personalized = personalizeBroadcastMessage(message, {
    name: "Kofi",
    campaignName: "Youth Night",
  });
  assert(personalized.includes("Kofi"), "Personalization replaces name");

  const shortUnits = estimateSmsUnits("Hello world", 10);
  assert(shortUnits === 10, "Single-segment SMS units");

  const longMessage = "x".repeat(161);
  const longUnits = estimateSmsUnits(longMessage, 5);
  assert(longUnits === 10, "Multi-segment SMS units (2 segments x 5 recipients)");
}

function testProviderAbstraction() {
  const provider = new UnconfiguredSmsProvider();
  assert(!provider.isConfigured, "Unconfigured provider reports not configured");
  assert(provider.name === "unconfigured", "Unconfigured provider name");

  const activeProvider = getSmsProvider();
  assert(typeof activeProvider.send === "function", "Provider exposes send");
  assert(typeof activeProvider.sendBulk === "function", "Provider exposes sendBulk");
  assert(
    typeof activeProvider.getDeliveryStatus === "function",
    "Provider exposes getDeliveryStatus",
  );

  if (!process.env.SMS_PROVIDER) {
    assert(!activeProvider.isConfigured, "Default env has unconfigured provider");
    assert(getConfiguredProviderName() === null, "No configured provider name");
  }
}

async function testMissingProviderBehavior() {
  const provider = new UnconfiguredSmsProvider();

  try {
    await provider.send({ to: "+233000000000", body: "Test" });
    assert(false, "Unconfigured send should throw");
  } catch (error) {
    assert(
      error instanceof SmsProviderNotConfiguredError,
      "Unconfigured send throws SmsProviderNotConfiguredError",
    );
  }

  try {
    await provider.sendBulk({
      messages: [{ to: "+233000000000", body: "Test" }],
    });
    assert(false, "Unconfigured bulk send should throw");
  } catch (error) {
    assert(
      error instanceof SmsProviderNotConfiguredError,
      "Unconfigured bulk send throws",
    );
  }
}

function testBroadcastHistoryShape() {
  const scopeConfig = buildScopeConfig({
    scope: "RESPONSE_TYPE",
    campaignId: "11111111-1111-4111-8111-111111111111",
    response: "COMING",
  });

  assert(scopeConfig.scope === "RESPONSE_TYPE", "Scope config stores scope");
  assert(scopeConfig.response === "COMING", "Scope config stores response");
  assert(Array.isArray(scopeConfig.contactIds), "Scope config includes contactIds");
}

function testStoredScopeContextLabels() {
  const label = formatStoredScopeContext(
    {
      governorId: "gov-1",
      response: "COMING",
      contactIds: ["c1", "c2"],
    },
    new Map([["gov-1", "Pastor Kwame"]]),
  );

  assert(Boolean(label?.includes("Pastor Kwame")), "Governor name shown in context");
  assert(Boolean(label?.includes("Coming")), "Response label shown in context");
  assert(Boolean(label?.includes("2 selected contact")), "Selected contact count shown");
}

async function main() {
  testBroadcastPermissions();
  testRecipientSelectionValidation();
  testMessagePreviewAndUnits();
  testProviderAbstraction();
  await testMissingProviderBehavior();
  testBroadcastHistoryShape();
  testStoredScopeContextLabels();
  console.log("Phase 7 broadcast tests passed.");
}

void main();
