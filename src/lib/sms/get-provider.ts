import { createTwilioProviderFromEnv } from "@/lib/sms/providers/twilio";
import type { SmsProvider } from "@/lib/sms/types";
import { UnconfiguredSmsProvider } from "@/lib/sms/unconfigured-provider";

let cachedProvider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (providerName === "twilio") {
    const twilio = createTwilioProviderFromEnv();
    cachedProvider = twilio ?? new UnconfiguredSmsProvider();
    return cachedProvider;
  }

  cachedProvider = new UnconfiguredSmsProvider();
  return cachedProvider;
}

export function isSmsProviderConfigured() {
  return getSmsProvider().isConfigured;
}

export function getConfiguredProviderName() {
  const provider = getSmsProvider();
  return provider.isConfigured ? provider.name : null;
}
