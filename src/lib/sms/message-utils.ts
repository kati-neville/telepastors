export function estimateSmsUnits(message: string, recipientCount: number) {
  const segmentSize = /[^\u0000-\u007F]/.test(message) ? 70 : 160;
  const segmentsPerMessage = Math.max(1, Math.ceil(message.length / segmentSize));
  return segmentsPerMessage * recipientCount;
}

export function personalizeBroadcastMessage(
  template: string,
  contact: { name: string; campaignName?: string | null },
) {
  return template
    .replaceAll("{name}", contact.name)
    .replaceAll("{campaign}", contact.campaignName ?? "our upcoming event");
}

export function buildMessagePreview(
  template: string,
  sampleContact?: { name: string; campaignName?: string | null },
) {
  return personalizeBroadcastMessage(
    template,
    sampleContact ?? { name: "John Mensah", campaignName: "Sunday Service" },
  );
}
