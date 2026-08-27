import type { SmsBulkSendResult, SmsDeliveryStatus, SmsProvider, SmsSendResult } from "@/lib/sms/types";
import { SmsProviderNotConfiguredError } from "@/lib/sms/types";

export class UnconfiguredSmsProvider implements SmsProvider {
  name = "unconfigured";
  isConfigured = false;

  async send(input: { to: string; body: string }): Promise<SmsSendResult> {
    void input;
    throw new SmsProviderNotConfiguredError();
  }

  async sendBulk(input: {
    messages: Array<{ to: string; body: string; metadata?: Record<string, string> }>;
  }): Promise<SmsBulkSendResult> {
    void input;
    throw new SmsProviderNotConfiguredError();
  }

  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus> {
    void messageId;
    throw new SmsProviderNotConfiguredError();
  }
}

export function getSmsProviderStatusMessage() {
  return "SMS sending is unavailable. Configure SMS_PROVIDER and provider credentials in your environment.";
}
