import { canViewUser, type AuthorizationContext } from "@/lib/auth/permissions";
import {
  calculateAge,
  formatBirthdayDisplay,
  getBirthdayDay,
  getBirthdayMonth,
  isBirthdayToday,
  matchesBirthdayFilter,
  sortBirthdayEntries,
} from "@/lib/birthdays/view";
import { getGovernorIdForTelepastor } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { BirthdayEntry, BirthdayNotice, Telepastor } from "@/types/domain";
import type { BirthdayFilterValues } from "@/lib/validations/birthdays";

function enrichBirthdayEntries(telepastors: Telepastor[]): BirthdayEntry[] {
  const byId = new Map(telepastors.map((entry) => [entry.id, entry]));

  return telepastors
    .filter((entry): entry is Telepastor & { date_of_birth: string } =>
      Boolean(entry.date_of_birth),
    )
    .map((entry) => {
      const leader = entry.leader_id ? byId.get(entry.leader_id) : undefined;
      const governorId =
        entry.role === "LEADER"
          ? entry.governor_id
          : getGovernorIdForTelepastor(entry, leader);
      const governor = governorId ? byId.get(governorId) : undefined;

      return {
        ...entry,
        leader_name: leader?.name ?? null,
        governor_name: governor?.name ?? null,
        birthdayMonth: getBirthdayMonth(entry.date_of_birth),
        birthdayDay: getBirthdayDay(entry.date_of_birth),
        age: calculateAge(entry.date_of_birth),
        birthdayLabel: formatBirthdayDisplay(entry.date_of_birth),
      };
    });
}

function isVisibleToViewer(
  context: AuthorizationContext,
  entry: Telepastor,
  membersById: Map<string, Telepastor>,
): boolean {
  const leader = entry.leader_id ? membersById.get(entry.leader_id) : null;
  return canViewUser(context, entry, leader);
}

async function fetchVisibleBirthdayEntries(
  context: AuthorizationContext,
): Promise<{
  entries: BirthdayEntry[];
  membersById: Map<string, Telepastor>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telepastors")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  const telepastors = data ?? [];
  const membersById = new Map(telepastors.map((entry) => [entry.id, entry]));
  const entries = enrichBirthdayEntries(telepastors).filter((entry) =>
    isVisibleToViewer(context, entry, membersById),
  );

  return { entries, membersById };
}

export async function fetchBirthdays(
  context: AuthorizationContext,
  filters: BirthdayFilterValues,
): Promise<BirthdayEntry[]> {
  const { entries } = await fetchVisibleBirthdayEntries(context);

  return sortBirthdayEntries(
    entries.filter((entry) => {
      if (filters.role !== "ALL" && entry.role !== filters.role) {
        return false;
      }

      return matchesBirthdayFilter(entry.date_of_birth, filters);
    }),
  );
}

export async function fetchBirthdayNotice(
  context: AuthorizationContext,
): Promise<BirthdayNotice> {
  const { entries } = await fetchVisibleBirthdayEntries(context);
  const viewerBirthdayToday = context.telepastor.date_of_birth
    ? isBirthdayToday(context.telepastor.date_of_birth)
    : false;

  const todaysBirthdays = sortBirthdayEntries(
    entries.filter((entry) => isBirthdayToday(entry.date_of_birth)),
  );

  return {
    viewerBirthdayToday,
    viewerName: context.telepastor.name,
    todaysBirthdays,
  };
}

export function getBirthdayScopeDescription(context: AuthorizationContext): string {
  switch (context.telepastor.role) {
    case "SUPER_ADMIN":
      return "All ministry members who have shared their date of birth.";
    case "GOVERNOR":
      return "Birthdays across your governor organization — leaders and telepastors under your governorship.";
    case "LEADER":
      return "Birthdays across your team — telepastors under your leadership.";
    default:
      return "Telepastors who have shared their date of birth.";
  }
}
