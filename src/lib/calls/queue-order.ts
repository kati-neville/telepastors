type QueueOrderContact = {
  name: string;
  attempt_count: number;
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
