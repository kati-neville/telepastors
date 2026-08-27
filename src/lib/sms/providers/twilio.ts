import type { SmsBulkSendResult, SmsDeliveryStatus, SmsProvider, SmsSendResult } from "@/lib/sms/types";

function mapTwilioStatus(status: string): SmsDeliveryStatus["status"] {
  switch (status) {
    case "queued":
    case "accepted":
      return "queued";
    case "sent":
    case "sending":
      return "sent";
    case "delivered":
      return "delivered";
    case "failed":
    case "undelivered":
      return "failed";
    default:
      return "unknown";
  }
}

export class TwilioSmsProvider implements SmsProvider {
  name = "twilio";
  isConfigured = true;

  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string,
  ) {}

  private get authHeader() {
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      "base64",
    );
    return `Basic ${credentials}`;
  }

  async send(input: { to: string; body: string }): Promise<SmsSendResult> {
    const params = new URLSearchParams({
      To: input.to,
      From: this.fromNumber,
      Body: input.body,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    const payload = (await response.json()) as {
      sid?: string;
      status?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: payload.message ?? "Twilio send failed.",
        status: "failed",
      };
    }

    return {
      success: true,
      messageId: payload.sid,
      status: mapTwilioStatus(payload.status ?? "queued"),
    };
  }

  async sendBulk(input: {
    messages: Array<{ to: string; body: string; metadata?: Record<string, string> }>;
  }): Promise<SmsBulkSendResult> {
    const results = [];

    for (const message of input.messages) {
      const result = await this.send({ to: message.to, body: message.body });
      results.push({
        ...result,
        to: message.to,
        metadata: message.metadata,
      });
    }

    return { results };
  }

  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryStatus> {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages/${messageId}.json`,
      {
        headers: {
          Authorization: this.authHeader,
        },
      },
    );

    const payload = (await response.json()) as {
      status?: string;
      error_message?: string;
    };

    if (!response.ok) {
      return {
        messageId,
        status: "failed",
        error: payload.error_message ?? "Unable to fetch delivery status.",
      };
    }

    return {
      messageId,
      status: mapTwilioStatus(payload.status ?? "unknown"),
      error: payload.error_message,
    };
  }
}

export function createTwilioProviderFromEnv(): TwilioSmsProvider | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return new TwilioSmsProvider(accountSid, authToken, fromNumber);
}
