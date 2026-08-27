export type SmsDeliveryState = "queued" | "sent" | "delivered" | "failed" | "unknown";

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  status: SmsDeliveryState;
};

export type SmsBulkSendResult = {
  results: Array<
    SmsSendResult & {
      to: string;
      metadata?: Record<string, string>;
    }
  >;
};

export type SmsDeliveryStatus = {
  messageId: string;
  status: SmsDeliveryState;
  error?: string;
};

export type SmsProvider = {
  name: string;
  isConfigured: boolean;
  send(input: { to: string; body: string }): Promise<SmsSendResult>;
  sendBulk(input: {
    messages: Array<{ to: string; body: string; metadata?: Record<string, string> }>;
  }): Promise<SmsBulkSendResult>;
  getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus>;
};

export class SmsProviderNotConfiguredError extends Error {
  constructor() {
    super("SMS provider is not configured.");
    this.name = "SmsProviderNotConfiguredError";
  }
}
