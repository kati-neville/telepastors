import {
  getCallQueueFormDefaults,
  shouldSuggestCallNotes,
} from "@/lib/calls/form-defaults";
import { filterAndSortAssignedContacts } from "@/lib/calls/assigned-contacts-sort";
import {
  selectNextQueueContacts,
  sortContactsForCalling,
} from "@/lib/calls/queue-order";
import { applySavedCallToQueueStats } from "@/lib/calls/queue-stats";
import {
  canAccessCallQueue,
  canRecordCallAttempt,
  canViewAssignedContact,
} from "@/lib/auth/calls";
import {
  buildTelLink,
  buildWhatsAppLink,
  buildWhatsAppMessage,
} from "@/lib/config/calling";
import { recordCallAttemptSchema } from "@/lib/validations/calls";
import type { Telepastor } from "@/types/domain";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTelepastor(
  overrides: Partial<Telepastor> & Pick<Telepastor, "id" | "role">,
): Telepastor {
  return {
    auth_user_id: null,
    organization_id: overrides.organization_id ?? "org-1",
    name: overrides.name ?? "Test User",
    phone: "+233000000000",
    phone_normalized: null,
    address: null,
    profile_picture_url: null,
    date_of_birth: null,
    occupation: null,
    is_active: true,
    must_change_password: false,
    leader_id: null,
    governor_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function contextFor(telepastor: Telepastor) {
  return { telepastor };
}

function testAuthorization() {
  const telepastorA = makeTelepastor({ id: "tp-a", role: "TELEPASTOR" });
  const telepastorB = makeTelepastor({ id: "tp-b", role: "TELEPASTOR" });
  const leader = makeTelepastor({ id: "lead-a", role: "LEADER" });
  const governor = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
  const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });

  const assignedToA = {
    current_assignee_id: "tp-a",
  };
  const assignedToLeader = {
    current_assignee_id: "lead-a",
  };
  const assignedToGovernor = {
    current_assignee_id: "gov-a",
  };

  assert(canAccessCallQueue(contextFor(telepastorA)), "Telepastor can access queue");
  assert(canAccessCallQueue(contextFor(leader)), "Leader can access queue");
  assert(canAccessCallQueue(contextFor(governor)), "Governor can access queue");
  assert(!canAccessCallQueue(contextFor(superAdmin)), "Super Admin cannot access queue");

  assert(
    canRecordCallAttempt(contextFor(telepastorA), assignedToA),
    "Telepastor can record for own contact",
  );
  assert(
    canRecordCallAttempt(contextFor(leader), assignedToLeader),
    "Leader can record for own contact",
  );
  assert(
    canRecordCallAttempt(contextFor(governor), assignedToGovernor),
    "Governor can record for own contact",
  );
  assert(
    !canRecordCallAttempt(contextFor(telepastorB), assignedToA),
    "Other telepastor cannot record",
  );

  assert(
    canViewAssignedContact(contextFor(telepastorA), assignedToA),
    "Telepastor can view own contact",
  );
  assert(
    canViewAssignedContact(contextFor(leader), assignedToLeader),
    "Leader can view own contact",
  );
  assert(
    !canViewAssignedContact(contextFor(telepastorB), assignedToA),
    "Other telepastor cannot view contact",
  );
}

function testCallLinks() {
  const tel = buildTelLink("+233244123456");
  assert(tel === "tel:+233244123456", "tel link format");

  const message = buildWhatsAppMessage("John Mensah", "Easter Outreach");
  assert(message.includes("John Mensah"), "WhatsApp message includes name");

  const whatsapp = buildWhatsAppLink("+233244123456", message);
  assert(whatsapp.startsWith("https://wa.me/233244123456?text="), "WhatsApp link format");
  assert(whatsapp.includes(encodeURIComponent("John Mensah")), "WhatsApp link encodes message");
}

function testResponseValidation() {
  const valid = recordCallAttemptSchema.safeParse({
    contactId: "550e8400-e29b-41d4-a716-446655440000",
    response: "COMING",
  });
  assert(valid.success, "COMING is valid");

  const otherWithoutNotes = recordCallAttemptSchema.safeParse({
    contactId: "550e8400-e29b-41d4-a716-446655440000",
    response: "OTHER",
  });
  assert(!otherWithoutNotes.success, "OTHER without notes fails");

  const otherWithNotes = recordCallAttemptSchema.safeParse({
    contactId: "550e8400-e29b-41d4-a716-446655440000",
    response: "OTHER",
    notes: "Will confirm later",
  });
  assert(otherWithNotes.success, "OTHER with notes passes");

  for (const response of [
    "NOT_COMING",
    "UNREACHABLE",
    "SWITCHED_OFF",
    "WRONG_NUMBER",
  ] as const) {
    const parsed = recordCallAttemptSchema.safeParse({
      contactId: "550e8400-e29b-41d4-a716-446655440000",
      response,
    });
    assert(parsed.success, `${response} is valid`);
  }
}

function testCallHistoryModel() {
  type Attempt = {
    id: string;
    contact_id: string;
    response: string;
    attempted_at: string;
  };

  const history: Attempt[] = [];

  function record(response: string) {
    history.push({
      id: `attempt-${history.length + 1}`,
      contact_id: "contact-1",
      response,
      attempted_at: new Date().toISOString(),
    });
  }

  record("UNREACHABLE");
  record("UNREACHABLE");
  record("COMING");

  assert(history.length === 3, "All attempts preserved");
  assert(history[0]!.response === "UNREACHABLE", "First attempt retained");
  assert(history[2]!.response === "COMING", "Latest attempt is Coming");
}

function testQueueProgress() {
  const assigned = 50;
  const completed = 18;
  const remaining = assigned - completed;

  assert(remaining === 32, "Remaining count");
  assert(`${completed} / ${assigned}`.includes("18 / 50"), "Progress counter format");
}

function testQueuePrioritizesUncalledContacts() {
  const ordered = sortContactsForCalling([
    { id: "tried-a", name: "Ama", attempt_count: 2 },
    { id: "fresh-z", name: "Zainab", attempt_count: 0 },
    { id: "tried-b", name: "Kojo", attempt_count: 1 },
    { id: "fresh-b", name: "Bernard", attempt_count: 0 },
  ]);

  assert(
    ordered.map((contact) => contact.id).join(",") ===
      "fresh-b,fresh-z,tried-b,tried-a",
    "Uncalled contacts come before any with attempts, then fewer attempts, then name",
  );

  const next = selectNextQueueContacts(
    [
      { id: "done", name: "Akosua", attempt_count: 0, latest_response: "COMING" },
      { id: "tried-a", name: "Ama", attempt_count: 2, latest_response: null },
      { id: "fresh-z", name: "Zainab", attempt_count: 0, latest_response: null },
      { id: "skipped", name: "Kojo", attempt_count: 0, latest_response: null },
      { id: "fresh-b", name: "Bernard", attempt_count: 0, latest_response: null },
    ],
    { skipIds: ["skipped"], limit: 3 },
  );

  assert(
    next.map((contact) => contact.id).join(",") === "fresh-b,fresh-z,tried-a",
    "Next window is uncalled first, skips responded and skipped ids",
  );
}

function testOptimisticQueueStats() {
  const stats = {
    assigned: 10,
    completed: 3,
    remaining: 7,
    coming: 2,
    notComing: 1,
    unreachable: 0,
    switchedOff: 0,
    wrongNumber: 0,
    other: 0,
  };

  const afterComing = applySavedCallToQueueStats(stats, "COMING", {
    previousResponse: null,
  });
  assert(afterComing.coming === 3, "Coming bucket increments");
  assert(afterComing.completed === 4, "Completed increments");
  assert(afterComing.remaining === 6, "Remaining decrements");

  const afterChange = applySavedCallToQueueStats(stats, "NOT_COMING", {
    previousResponse: "UNREACHABLE",
  });
  assert(afterChange.completed === 3, "Re-saving a completed contact does not recount");
  assert(afterChange.remaining === 7, "Re-saving does not change remaining");
  assert(afterChange.notComing === 2, "New response bucket increments");
  assert(afterChange.unreachable === 0, "Previous response bucket decrements");
}

function testAssignedContactsAttemptedSort() {
  const now = new Date(2026, 9, 18, 12);
  const contacts = [
    {
      name: "Kojo",
      latest_response_at: new Date(2026, 9, 18, 8).toISOString(),
      attempt_count: 1,
    },
    {
      name: "Ama",
      latest_response_at: new Date(2026, 9, 14, 8).toISOString(),
      attempt_count: 2,
    },
    {
      name: "Zainab",
      latest_response_at: null,
      attempt_count: 0,
    },
    {
      name: "Bernard",
      latest_response_at: new Date(2026, 9, 1, 8).toISOString(),
      attempt_count: 1,
    },
  ];

  assert(
    filterAndSortAssignedContacts(contacts, "today", now)
      .map((contact) => contact.name)
      .join(",") === "Kojo",
    "Today is only contacts attempted today, newest first",
  );
  assert(
    filterAndSortAssignedContacts(contacts, "week", now)
      .map((contact) => contact.name)
      .join(",") === "Kojo,Ama",
    "This week includes today and earlier this week",
  );
  assert(
    filterAndSortAssignedContacts(contacts, "month", now)
      .map((contact) => contact.name)
      .join(",") === "Kojo,Ama,Bernard",
    "This month includes all October attempts",
  );
  assert(
    filterAndSortAssignedContacts(contacts, "never", now)
      .map((contact) => contact.name)
      .join(",") === "Zainab",
    "Not attempted is contacts with no attempts",
  );
  assert(
    filterAndSortAssignedContacts(contacts, "recent", now)
      .map((contact) => contact.name)
      .join(",") === "Kojo,Ama,Bernard",
    "Last attempted is newest first and excludes never attempted",
  );
}

function testCallQueueFormDefaults() {
  const defaults = getCallQueueFormDefaults({
    id: "contact-1",
    organization_id: "org-1",
    campaign_id: "camp-1",
    name: "Jane Doe",
    phone: "+233244123456",
    phone_normalized: "+233244123456",
    import_id: null,
    import_row_number: null,
    import_metadata: null,
    latest_response: "NOT_COMING",
    latest_notes: "Sick this week",
    latest_response_at: "2026-01-01T00:00:00.000Z",
    latest_recorded_by: "tp-a",
    held_for_own_calls: false,
    assignment_status: "IN_PROGRESS",
    current_assignee_id: "tp-a",
    current_assignment_id: "assign-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    campaign_name: "Easter",
    campaign_call_script: null,
    attempt_count: 2,
    prior_attempts: [
      {
        id: "attempt-1",
        contact_id: "contact-1",
        campaign_id: "camp-1",
        telepastor_id: "tp-a",
        assignment_id: "assign-1",
        response: "UNREACHABLE",
        notes: "No answer",
        attempted_at: "2025-12-31T00:00:00.000Z",
      },
    ],
  });

  assert(defaults.response === "NOT_COMING", "Prefills latest response");
  assert(defaults.notes === "Sick this week", "Prefills denormalized notes");

  assert(
    shouldSuggestCallNotes("NOT_COMING", ""),
    "Suggests notes for not coming without notes",
  );
  assert(
    !shouldSuggestCallNotes("NOT_COMING", "Already noted"),
    "Does not suggest when notes exist",
  );
  assert(
    !shouldSuggestCallNotes("COMING", ""),
    "Does not suggest for coming",
  );
}

function main() {
  testAuthorization();
  testCallLinks();
  testResponseValidation();
  testCallHistoryModel();
  testQueueProgress();
  testQueuePrioritizesUncalledContacts();
  testOptimisticQueueStats();
  testAssignedContactsAttemptedSort();
  testCallQueueFormDefaults();
  console.log("Phase 5 call workflow tests passed.");
}

main();
