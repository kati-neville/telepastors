import { getReportableMembers, getScopedAssigneeIds } from "@/lib/auth/reports";
import {
  buildTeamMemberDrillDownQuery,
  getAvailableTeamPerformanceViews,
  getDefaultTeamPerformanceView,
  memberMatchesPerformanceView,
  resolveTeamPerformanceView,
} from "@/lib/reports/team-performance-view";
import { computeContactStatistics } from "@/lib/stats/compute";
import { truncateText } from "@/lib/utils/text";
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

function testUniqueContactStatistics() {
  const contacts = [
    {
      id: "c1",
      campaign_id: "camp-1",
      latest_response: "COMING" as const,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    },
    {
      id: "c2",
      campaign_id: "camp-1",
      latest_response: null,
      assignment_status: "ASSIGNED" as const,
      current_assignee_id: "tp-a",
    },
  ];

  const stats = computeContactStatistics(contacts, 5);

  assert(stats.totalContacts === 2, "Counts unique contacts");
  assert(stats.completed === 1, "One completed contact");
  assert(stats.remaining === 1, "One remaining contact");
  assert(stats.coming === 1, "One coming contact");
  assert(stats.totalCallAttempts === 5, "Attempts tracked separately");
  assert(stats.completionPercentage === 50, "Completion percentage");
}

function testRepeatedAttemptsDoNotInflateContacts() {
  const contacts = [
    {
      id: "c1",
      campaign_id: "camp-1",
      latest_response: "UNREACHABLE" as const,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    },
  ];

  const stats = computeContactStatistics(contacts, 3);

  assert(stats.totalContacts === 1, "Still one unique contact");
  assert(stats.unreachable === 1, "Latest response used");
  assert(stats.totalCallAttempts === 3, "Three attempts recorded separately");
}

function testReachAndComingRates() {
  const contacts = [
    {
      id: "c1",
      campaign_id: "camp-1",
      latest_response: "COMING" as const,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    },
    {
      id: "c2",
      campaign_id: "camp-1",
      latest_response: "UNREACHABLE" as const,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    },
    {
      id: "c3",
      campaign_id: "camp-1",
      latest_response: "NOT_COMING" as const,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    },
    {
      id: "c4",
      campaign_id: "camp-1",
      latest_response: null,
      assignment_status: "ASSIGNED" as const,
      current_assignee_id: "tp-a",
    },
  ];

  const stats = computeContactStatistics(contacts, 8);

  assert(stats.reachRate === 50, "Reach excludes unreachable");
  assert(stats.comingPercentage === 33.3, "Coming percentage of completed");
}

function testReportScoping() {
  const governor = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
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
  const tpA = makeTelepastor({
    id: "tp-a",
    role: "TELEPASTOR",
    leader_id: "lead-a",
    governor_id: "gov-a",
  });
  const tpB = makeTelepastor({
    id: "tp-b",
    role: "TELEPASTOR",
    leader_id: "lead-b",
    governor_id: "gov-b",
  });

  const allMembers = [governor, leaderA, leaderB, tpA, tpB];

  const governorScope = getReportableMembers(
    { telepastor: governor },
    {},
    allMembers,
  );
  const governorIds = getScopedAssigneeIds(governorScope);
  assert(governorIds.includes("lead-a"), "Governor sees own leader");
  assert(governorIds.includes("tp-a"), "Governor sees own telepastor");
  assert(!governorIds.includes("lead-b"), "Governor isolated from other org");
  assert(!governorIds.includes("tp-b"), "Governor isolated from other telepastor");

  const leaderScope = getReportableMembers(
    { telepastor: leaderA },
    {},
    allMembers,
  );
  const leaderIds = getScopedAssigneeIds(leaderScope);
  assert(leaderIds.includes("tp-a"), "Leader sees own telepastor");
  assert(!leaderIds.includes("tp-b"), "Leader isolated from other team");

  const telepastorScope = getReportableMembers(
    { telepastor: tpA },
    {},
    allMembers,
  );
  assert(telepastorScope.length === 1, "Telepastor sees only self");
  assert(telepastorScope[0]!.id === "tp-a", "Telepastor self scope");
}

function testTeamPerformanceViews() {
  assert(
    getAvailableTeamPerformanceViews("SUPER_ADMIN").join(",") ===
      "governor,leader,telepastor",
    "Super admin view modes",
  );
  assert(
    getAvailableTeamPerformanceViews("GOVERNOR").join(",") === "leader,telepastor",
    "Governor view modes",
  );
  assert(
    getAvailableTeamPerformanceViews("LEADER").join(",") === "telepastor",
    "Leader view modes",
  );

  assert(getDefaultTeamPerformanceView("SUPER_ADMIN") === "governor", "Super admin default");
  assert(getDefaultTeamPerformanceView("GOVERNOR") === "leader", "Governor default");
  assert(getDefaultTeamPerformanceView("LEADER") === "telepastor", "Leader default");

  assert(
    resolveTeamPerformanceView("GOVERNOR", "governor") === "leader",
    "Invalid view falls back to role default",
  );
  assert(
    resolveTeamPerformanceView("GOVERNOR", "telepastor") === "telepastor",
    "Governor can select telepastor view",
  );

  assert(memberMatchesPerformanceView("LEADER", "leader"), "Leader matches leader view");
  assert(!memberMatchesPerformanceView("TELEPASTOR", "leader"), "Telepastor excluded from leader view");

  const drillDown = buildTeamMemberDrillDownQuery(
    "GOVERNOR",
    "leader",
    {
      memberId: "lead-a",
      memberName: "Leader A",
      memberRole: "LEADER",
      stats: computeContactStatistics([], 0),
      totalCallAttempts: 0,
      lastAttemptAt: null,
    },
    {},
  );

  assert(drillDown?.view === "telepastor", "Governor leader drill-down switches view");
  assert(drillDown?.leaderId === "lead-a", "Governor leader drill-down sets leaderId");
}

function testTruncateText() {
  assert(truncateText("Short note") === "Short note", "Short text unchanged");
  assert(
    truncateText("abcdefghijklmnopqrstuvwxyz", 10) === "abcdefghi…",
    "Long text truncated",
  );
}

function main() {
  testUniqueContactStatistics();
  testRepeatedAttemptsDoNotInflateContacts();
  testReachAndComingRates();
  testReportScoping();
  testTeamPerformanceViews();
  testTruncateText();
  console.log("Phase 6 statistics tests passed.");
}

main();
