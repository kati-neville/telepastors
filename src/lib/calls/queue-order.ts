type QueueOrderContact = {
  name: string;
  attempt_count: number;
};

export type QueueSelectableContact = QueueOrderContact & {
  id: string;
  latest_response?: string | null;
};

export function compareContactsForCalling(
  left: QueueOrderContact,
  right: QueueOrderContact,
): number {
  if (left.attempt_count !== right.attempt_count) {
    return left.attempt_count - right.attempt_count;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

export function sortContactsForCalling<T extends QueueOrderContact>(
  contacts: T[],
): T[] {
  return [...contacts].sort(compareContactsForCalling);
}

export function selectNextQueueContacts<T extends QueueSelectableContact>(
  contacts: T[],
  options: {
    skipIds?: string[];
    limit: number;
  },
): T[] {
  const skip = new Set(options.skipIds ?? []);

  return sortContactsForCalling(
    contacts.filter(
      (contact) => !contact.latest_response && !skip.has(contact.id),
    ),
  ).slice(0, Math.max(0, options.limit));
}
