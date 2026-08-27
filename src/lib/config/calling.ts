import type { CallResponse } from "@/types/domain";

const DEFAULT_WHATSAPP_TEMPLATE =
  "Hello {name}, this is from First Love Church. We would love to confirm your attendance. God bless you!";

export function getWhatsAppMessageTemplate() {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE_TEMPLATE ??
    DEFAULT_WHATSAPP_TEMPLATE
  );
}

export function buildWhatsAppMessage(
  contactName: string,
  campaignName?: string | null,
  templateBody?: string,
) {
  const template = templateBody ?? getWhatsAppMessageTemplate();
  return template
    .replaceAll("{name}", contactName)
    .replaceAll("{campaign}", campaignName ?? "our upcoming event");
}

export function buildTelLink(phoneNormalized: string) {
  return `tel:${phoneNormalized}`;
}

export function buildWhatsAppLink(
  phoneNormalized: string,
  message: string,
) {
  const digits = phoneNormalized.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}

export const CALL_RESPONSE_LABELS: Record<CallResponse, string> = {
  COMING: "Coming",
  NOT_COMING: "Not Coming",
  UNREACHABLE: "Unreachable",
  WRONG_NUMBER: "Wrong Number",
  OTHER: "Other",
};

export const CALL_RESPONSE_SHORT_LABELS: Record<CallResponse, string> = {
  COMING: "Coming",
  NOT_COMING: "Not Coming",
  UNREACHABLE: "Unreachable",
  WRONG_NUMBER: "Wrong Number",
  OTHER: "Other",
};
