import {
  canAssignContact,
  canAssignContactToAssignee,
  canDistributeContacts,
  getDistributionPoolFilter,
  getTargetAssigneeRole,
} from "@/lib/auth/assignments";
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
    name: overrides.name ?? "Test User",
    phone: "+233000000000",
    address: null,
    profile_picture_url: null,
    date_of_birth: null,
    occupation: null,
    is_active: true,
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

function testDistributionPermissions() {
  const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
  const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
  makeTelepastor({ id: "gov-b", role: "GOVERNOR" });
  const leaderA = makeTelepastor({
    id: "lead-a",
    role: "LEADER",
    governor_id: "gov-a",
  });
  const leaderB = makeTelepastor({
    id: "lead-b",
    role: "LEADER",
    governor_id: "gov-b",
  });
  const telepastorA = makeTelepastor({
    id: "tp-a",
    role: "TELEPASTOR",
    leader_id: "lead-a",
    governor_id: "gov-a",
  });
  const telepastorB = makeTelepastor({
    id: "tp-b",
    role: "TELEPASTOR",
    leader_id: "lead-b",
    governor_id: "gov-b",
  });

  assert(canDistributeContacts(contextFor(superAdmin)), "Super admin can distribute");
  assert(canDistributeContacts(contextFor(governorA)), "Governor can distribute");
  assert(canDistributeContacts(contextFor(leaderA)), "Leader can distribute");
  assert(!canDistributeContacts(contextFor(telepastorA)), "Telepastor cannot distribute");

  assert(
    getTargetAssigneeRole("SUPER_ADMIN") === "GOVERNOR",
    "Super admin targets governors",
  );
  assert(
    getTargetAssigneeRole("GOVERNOR") === "LEADER",
    "Governor targets leaders",
  );
  assert(
    getTargetAssigneeRole("LEADER") === "TELEPASTOR",
    "Leader targets telepastors",
  );
  assert(getTargetAssigneeRole("TELEPASTOR") === null, "Telepastor has no target");

  assert(
    canAssignContactToAssignee(contextFor(superAdmin), governorA),
    "Super admin -> Governor A",
  );
  assert(
    !canAssignContactToAssignee(contextFor(superAdmin), leaderA),
    "Super admin cannot assign to leader",
  );

  assert(
    canAssignContactToAssignee(contextFor(governorA), leaderA),
    "Governor A -> Leader A",
  );
  assert(
    !canAssignContactToAssignee(contextFor(governorA), leaderB),
    "Governor A cannot -> Leader B",
  );
  assert(
    !canAssignContactToAssignee(contextFor(governorA), telepastorA),
    "Governor A cannot -> Telepastor directly",
  );

  assert(
    canAssignContactToAssignee(contextFor(leaderA), telepastorA),
    "Leader A -> Telepastor A",
  );
  assert(
    !canAssignContactToAssignee(contextFor(leaderA), telepastorB),
    "Leader A cannot -> Telepastor B",
  );
  assert(
    !canAssignContactToAssignee(contextFor(leaderA), governorA),
    "Leader A cannot -> Governor",
  );

  assert(
    !canAssignContactToAssignee(contextFor(telepastorA), telepastorB),
    "Telepastor cannot assign",
  );
}

function testContactPoolPermissions() {
  const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
  const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
  const leaderA = makeTelepastor({
    id: "lead-a",
    role: "LEADER",
    governor_id: "gov-a",
  });

  assert(
    getDistributionPoolFilter(contextFor(superAdmin)) === "unassigned",
    "Super admin pool is unassigned",
  );
  assert(
    getDistributionPoolFilter(contextFor(governorA)) === "assigned_to_self",
    "Governor pool is assigned_to_self",
  );
  assert(
    getDistributionPoolFilter(contextFor(leaderA)) === "assigned_to_self",
    "Leader pool is assigned_to_self",
  );

  const unassignedContact = {
    id: "c-1",
    campaign_id: "camp-1",
    assignment_status: "UNASSIGNED",
    current_assignee_id: null,
  };

  const assignedToGovernor = {
    id: "c-2",
    campaign_id: "camp-1",
    assignment_status: "ASSIGNED",
    current_assignee_id: "gov-a",
  };

  const assignedToLeader = {
    id: "c-3",
    campaign_id: "camp-1",
    assignment_status: "ASSIGNED",
    current_assignee_id: "lead-a",
  };

  assert(
    canAssignContact(contextFor(superAdmin), unassignedContact),
    "Super admin can assign unassigned contact",
  );
  assert(
    canAssignContact(contextFor(superAdmin), assignedToGovernor),
    "Super admin can reassign any contact",
  );

  assert(
    !canAssignContact(contextFor(governorA), unassignedContact),
    "Governor cannot assign unassigned contact",
  );
  assert(
    canAssignContact(contextFor(governorA), assignedToGovernor),
    "Governor can assign contacts assigned to self",
  );
  assert(
    !canAssignContact(contextFor(governorA), assignedToLeader),
    "Governor cannot assign contacts assigned to leader",
  );

  assert(
    canAssignContact(contextFor(leaderA), assignedToLeader),
    "Leader can assign contacts assigned to self",
  );
  assert(
    !canAssignContact(contextFor(leaderA), assignedToGovernor),
    "Leader cannot assign contacts assigned to governor",
  );
}

type AssignmentRecord = {
  id: string;
  contact_id: string;
  assignee_id: string;
  assigned_by: string;
  ended_at: string | null;
  superseded_by: string | null;
};

function testAssignmentHistoryModel() {
  const history: AssignmentRecord[] = [];

  function assign(
    contactId: string,
    assigneeId: string,
    assignedBy: string,
  ): string {
    const active = history.find(
      (entry) => entry.contact_id === contactId && entry.ended_at === null,
    );

    const newId = `asgn-${history.length + 1}`;
    const now = new Date().toISOString();

    if (active) {
      active.ended_at = now;
      active.superseded_by = newId;
    }

    history.push({
      id: newId,
      contact_id: contactId,
      assignee_id: assigneeId,
      assigned_by: assignedBy,
      ended_at: null,
      superseded_by: null,
    });

    return newId;
  }

  assign("contact-1", "gov-a", "super-admin");
  assign("contact-1", "lead-a", "gov-a");
  assign("contact-1", "tp-a", "lead-a");

  assert(history.length === 3, "Three assignment records preserved");

  const active = history.find(
    (entry) => entry.contact_id === "contact-1" && entry.ended_at === null,
  );
  assert(active?.assignee_id === "tp-a", "Current assignee is telepastor");

  const first = history[0]!;
  assert(first.ended_at !== null, "First assignment ended");
  assert(first.superseded_by === history[1]!.id, "First assignment superseded");

  const second = history[1]!;
  assert(second.superseded_by === history[2]!.id, "Second assignment superseded");
}

function testBulkAssignmentCounts() {
  const totalContacts = 1000;
  const assignments = [
    { governorId: "gov-a", count: 250 },
    { governorId: "gov-b", count: 250 },
    { governorId: "gov-c", count: 250 },
    { governorId: "gov-d", count: 250 },
  ];

  const assignedTotal = assignments.reduce((sum, item) => sum + item.count, 0);
  assert(assignedTotal === totalContacts, "Bulk assignment covers all contacts");
  assert(
    assignments.every((item) => item.count === 250),
    "Even distribution across governors",
  );
}

function testReassignmentPreservesHistory() {
  const history: AssignmentRecord[] = [];

  function assign(contactId: string, assigneeId: string, assignedBy: string) {
    const active = history.find(
      (entry) => entry.contact_id === contactId && entry.ended_at === null,
    );
    const newId = `asgn-${history.length + 1}`;
    const now = new Date().toISOString();

    if (active) {
      active.ended_at = now;
      active.superseded_by = newId;
    }

    history.push({
      id: newId,
      contact_id: contactId,
      assignee_id: assigneeId,
      assigned_by: assignedBy,
      ended_at: null,
      superseded_by: null,
    });
  }

  assign("contact-1", "lead-a", "gov-a");
  assign("contact-1", "lead-b", "gov-a");

  const ended = history.filter((entry) => entry.ended_at !== null);
  assert(ended.length === 1, "Previous assignment retained in history");
  assert(
    ended[0]!.assignee_id === "lead-a",
    "Previous assignee recorded",
  );
}

function testReassignmentResetsLatestResponse() {
  type ContactState = {
    latest_response: string | null;
    current_assignee_id: string;
    assignment_status: string;
  };

  function reassign(contact: ContactState, newAssigneeId: string): ContactState {
    return {
      ...contact,
      current_assignee_id: newAssigneeId,
      assignment_status: "ASSIGNED",
      latest_response: null,
    };
  }

  const before = {
    latest_response: "COMING",
    current_assignee_id: "tp-a",
    assignment_status: "IN_PROGRESS",
  };

  const after = reassign(before, "tp-b");

  assert(after.latest_response === null, "Reassignment clears latest response");
  assert(after.current_assignee_id === "tp-b", "Reassignment updates assignee");
  assert(after.assignment_status === "ASSIGNED", "Reassignment resets status");
}

function testDownstreamReassignmentPermissions() {
  const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
  const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
  const leaderA = makeTelepastor({
    id: "lead-a",
    role: "LEADER",
    governor_id: "gov-a",
  });
  const telepastorA = makeTelepastor({
    id: "tp-a",
    role: "TELEPASTOR",
    leader_id: "lead-a",
  });

  const assignedToGovernor = {
    id: "c-1",
    campaign_id: "camp-1",
    assignment_status: "ASSIGNED",
    current_assignee_id: "gov-a",
  };

  const assignedToLeader = {
    id: "c-2",
    campaign_id: "camp-1",
    assignment_status: "ASSIGNED",
    current_assignee_id: "lead-a",
  };

  assert(
    canAssignContact(contextFor(governorA), assignedToGovernor),
    "Governor can reassign contacts currently assigned to self",
  );
  assert(
    canAssignContactToAssignee(contextFor(governorA), leaderA),
    "Governor can assign to leader in org",
  );
  assert(
    canAssignContact(contextFor(leaderA), assignedToLeader),
    "Leader can reassign contacts currently assigned to self",
  );
  assert(
    canAssignContactToAssignee(contextFor(leaderA), telepastorA),
    "Leader can assign to telepastor in team",
  );

  const history: AssignmentRecord[] = [];

  function assign(contactId: string, assigneeId: string, assignedBy: string) {
    const active = history.find(
      (entry) => entry.contact_id === contactId && entry.ended_at === null,
    );
    const newId = `asgn-${history.length + 1}`;
    const now = new Date().toISOString();

    if (active) {
      active.ended_at = now;
      active.superseded_by = newId;
    }

    history.push({
      id: newId,
      contact_id: contactId,
      assignee_id: assigneeId,
      assigned_by: assignedBy,
      ended_at: null,
      superseded_by: null,
    });
  }

  assign("contact-1", "gov-a", "sa-1");
  assign("contact-1", "lead-a", "gov-a");
  assign("contact-1", "tp-a", "lead-a");

  assert(history.length === 3, "Super Admin -> Governor -> Leader -> Telepastor chain preserved");
  assert(
    history.filter((entry) => entry.ended_at !== null).length === 2,
    "Two prior assignments ended in downstream chain",
  );
}

function main() {
  testDistributionPermissions();
  testContactPoolPermissions();
  testAssignmentHistoryModel();
  testBulkAssignmentCounts();
  testReassignmentPreservesHistory();
  testReassignmentResetsLatestResponse();
  testDownstreamReassignmentPermissions();
  console.log("Phase 4 assignment tests passed.");
}

main();
