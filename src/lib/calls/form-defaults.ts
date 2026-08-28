import type { CallQueueContact, CallResponse } from "@/types/domain";

export function getCallQueueFormDefaults(contact: CallQueueContact | null): {
  response: CallResponse | null;
  notes: string;
} {
  if (!contact) {
    return { response: null, notes: "" };
  }

  const latestAttempt = contact.prior_attempts[0];
  const notes =
    contact.latest_notes?.trim() || latestAttempt?.notes?.trim() || "";

  return {
    response:
      contact.latest_response ?? latestAttempt?.response ?? null,
    notes,
  };
}

export function shouldSuggestCallNotes(
  response: CallResponse | null,
  notes: string,
): boolean {
  if (!response || notes.trim()) {
    return false;
  }

  return response === "NOT_COMING" || response === "UNREACHABLE";
}
