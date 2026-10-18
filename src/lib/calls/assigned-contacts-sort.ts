import { startOfDay, startOfMonth, startOfWeek } from "date-fns";

export const ASSIGNED_CONTACTS_SORTS = [
  "calling",
  "today",
  "week",
  "month",
  "recent",
  "never",
  "name",
] as const;

export type AssignedContactsSort = (typeof ASSIGNED_CONTACTS_SORTS)[number];

export const ASSIGNED_CONTACTS_SORT_ITEMS: Array<{
  value: AssignedContactsSort;
  label: string;
}> = [
  { value: "calling", label: "Calling order" },
  { value: "today", label: "Attempted today" },
  { value: "week", label: "Attempted this week" },
  { value: "month", label: "Attempted this month" },
  { value: "recent", label: "Last attempted" },
  { value: "never", label: "Not attempted" },
  { value: "name", label: "Name" },
];

export type SortableAssignedContact = {
  name: string;
  latest_response_at: string | null;
  attempt_count: number;
};

function compareNames(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function attemptedAtMs(contact: SortableAssignedContact): number | null {
  if (!contact.latest_response_at) {
    return null;
  }

  const value = new Date(contact.latest_response_at).getTime();
  return Number.isFinite(value) ? value : null;
}

function wasAttempted(contact: SortableAssignedContact) {
  return attemptedAtMs(contact) != null || contact.attempt_count > 0;
}

function periodStart(sort: AssignedContactsSort, now: Date): number | null {
  if (sort === "today") {
    return startOfDay(now).getTime();
  }

  if (sort === "week") {
    return startOfWeek(now, { weekStartsOn: 1 }).getTime();
  }

  if (sort === "month") {
    return startOfMonth(now).getTime();
  }

  return null;
}

function compareRecent(
  left: SortableAssignedContact,
  right: SortableAssignedContact,
) {
  const leftAt = attemptedAtMs(left);
  const rightAt = attemptedAtMs(right);

  if (leftAt != null && rightAt != null && leftAt !== rightAt) {
    return rightAt - leftAt;
  }

  if (leftAt != null && rightAt == null) {
    return -1;
  }

  if (leftAt == null && rightAt != null) {
    return 1;
  }

  return compareNames(left.name, right.name);
}

export function emptyAssignedContactsSortMessage(sort: AssignedContactsSort) {
  switch (sort) {
    case "today":
      return "No contacts attempted today.";
    case "week":
      return "No contacts attempted this week.";
    case "month":
      return "No contacts attempted this month.";
    case "recent":
      return "No attempted contacts yet.";
    case "never":
      return "Every assigned contact has been attempted.";
    default:
      return "No assigned contacts match your search.";
  }
}

export function filterAndSortAssignedContacts<T extends SortableAssignedContact>(
  contacts: T[],
  sort: AssignedContactsSort,
  now = new Date(),
): T[] {
  if (sort === "calling") {
    return contacts;
  }

  if (sort === "name") {
    return [...contacts].sort((left, right) => compareNames(left.name, right.name));
  }

  if (sort === "never") {
    return contacts
      .filter((contact) => !wasAttempted(contact))
      .sort((left, right) => compareNames(left.name, right.name));
  }

  const attempted = contacts.filter((contact) => wasAttempted(contact));
  const start = periodStart(sort, now);
  const inWindow =
    start == null
      ? attempted
      : attempted.filter((contact) => {
          const at = attemptedAtMs(contact);
          return at != null && at >= start;
        });

  return [...inWindow].sort(compareRecent);
}
