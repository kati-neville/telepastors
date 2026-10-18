import {
  applySavedCallToQueueStats,
  callQueueStatsFromResponses,
  revertSavedCallOnQueueStats,
} from "@/lib/calls/queue-stats";
import {
  computeContactStatistics,
  getReachedContactCount,
  percentOf,
} from "@/lib/stats/compute";
import { CALL_RESPONSES, type CallQueueStats, type CallResponse } from "@/types/domain";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStatsEqual(
  actual: CallQueueStats,
  expected: CallQueueStats,
  label: string,
) {
  const keys: Array<keyof CallQueueStats> = [
    "assigned",
    "completed",
    "remaining",
    "coming",
    "notComing",
    "unreachable",
    "switchedOff",
    "wrongNumber",
    "other",
  ];

  for (const key of keys) {
    assert(
      actual[key] === expected[key],
      `${label}: ${key} should be ${expected[key]}, got ${actual[key]}`,
    );
  }

  assert(
    actual.completed + actual.remaining === actual.assigned,
    `${label}: completed (${actual.completed}) + remaining (${actual.remaining}) must equal assigned (${actual.assigned})`,
  );
}

function testFirstSavesMatchReportCounters() {
  const responses: Array<CallResponse | null> = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];
  let stats = callQueueStatsFromResponses(responses);

  const saves: CallResponse[] = [
    "COMING",
    "NOT_COMING",
    "UNREACHABLE",
    "SWITCHED_OFF",
    "WRONG_NUMBER",
    "OTHER",
  ];

  for (const [index, response] of saves.entries()) {
    stats = applySavedCallToQueueStats(stats, response, {
      previousResponse: responses[index] ?? null,
    });
    responses[index] = response;
    assertStatsEqual(
      stats,
      callQueueStatsFromResponses(responses),
      `After saving ${response}`,
    );
  }

  assert(stats.assigned === 6, "Assigned stays 6");
  assert(stats.completed === 6, "All six contacts completed");
  assert(stats.remaining === 0, "None remaining");
  assert(stats.coming === 1, "One coming");
  assert(stats.notComing === 1, "One not coming");
  assert(stats.unreachable === 1, "One unreachable");
  assert(stats.switchedOff === 1, "One switched off");
  assert(stats.wrongNumber === 1, "One wrong number");
  assert(stats.other === 1, "One other");
}

function testChangingResponseDoesNotDoubleCount() {
  const responses: Array<CallResponse | null> = ["UNREACHABLE", null, null];
  let stats = callQueueStatsFromResponses(responses);

  stats = applySavedCallToQueueStats(stats, "COMING", {
    previousResponse: "UNREACHABLE",
  });
  responses[0] = "COMING";

  assertStatsEqual(
    stats,
    callQueueStatsFromResponses(responses),
    "After changing Unreachable to Coming",
  );
  assert(stats.unreachable === 0, "Old unreachable bucket is cleared");
  assert(stats.coming === 1, "Coming bucket receives the contact");
  assert(stats.completed === 1, "Completed is not incremented again");
  assert(stats.remaining === 2, "Remaining is unchanged");
}

function testSameResponseSaveIsIdempotent() {
  const responses: Array<CallResponse | null> = ["NOT_COMING", null];
  const before = callQueueStatsFromResponses(responses);
  const after = applySavedCallToQueueStats(before, "NOT_COMING", {
    previousResponse: "NOT_COMING",
  });

  assertStatsEqual(after, before, "Saving the same response again");
}

function testFailedSaveRestoresOnlyThatCall() {
  const responses: Array<CallResponse | null> = [null, null, null];
  let stats = callQueueStatsFromResponses(responses);

  stats = applySavedCallToQueueStats(stats, "COMING", {
    previousResponse: null,
  });
  responses[0] = "COMING";

  stats = applySavedCallToQueueStats(stats, "WRONG_NUMBER", {
    previousResponse: null,
  });

  stats = revertSavedCallOnQueueStats(stats, "WRONG_NUMBER", {
    previousResponse: null,
  });
  responses[1] = null;

  assertStatsEqual(
    stats,
    callQueueStatsFromResponses(responses),
    "Failed second save must not wipe the first successful save",
  );
  assert(stats.coming === 1, "First Coming save still counted");
  assert(stats.wrongNumber === 0, "Failed Wrong Number save is not counted");
  assert(stats.completed === 1, "Only the successful save is completed");
}

function testFailedFirstSaveRestoresEmptyQueue() {
  const responses: Array<CallResponse | null> = [null, null];
  const before = callQueueStatsFromResponses(responses);
  const optimistic = applySavedCallToQueueStats(before, "OTHER", {
    previousResponse: null,
  });
  const restored = revertSavedCallOnQueueStats(optimistic, "OTHER", {
    previousResponse: null,
  });

  assertStatsEqual(restored, before, "Failed first save");
}

function testSkipDoesNotChangeStats() {
  const responses: Array<CallResponse | null> = [null, "COMING", null];
  const stats = callQueueStatsFromResponses(responses);
  assertStatsEqual(
    stats,
    callQueueStatsFromResponses(responses),
    "Skip leaves latest_response unchanged",
  );
  assert(stats.remaining === 2, "Skipped contacts stay remaining");
  assert(stats.completed === 1, "Skip does not complete a contact");
}

function testHeadlineReachedMatchesReportRates() {
  const rows = [
    ...CALL_RESPONSES.map((latest_response, index) => ({
      id: `c-${index}`,
      campaign_id: "camp-1",
      latest_response,
      assignment_status: "IN_PROGRESS" as const,
      current_assignee_id: "tp-a",
    })),
    {
      id: "c-remaining",
      campaign_id: "camp-1",
      latest_response: null,
      assignment_status: "ASSIGNED" as const,
      current_assignee_id: "tp-a",
    },
  ];

  const stats = computeContactStatistics(rows, 9);
  const reached = getReachedContactCount(stats);

  assert(stats.totalContacts === 7, "Six responses plus one remaining");
  assert(stats.completed === 6, "Completed is contacts with a latest response");
  assert(stats.remaining === 1, "One contact still remaining");
  assert(
    reached === stats.coming + stats.notComing + stats.other,
    "Reached is Coming + Not Coming + Other",
  );
  assert(reached === 3, "Wrong Number, Unreachable, and Switched Off are not reached");
  assert(
    stats.reachRate === percentOf(reached, stats.totalContacts),
    "Reach rate uses the same reached count shown on the dashboard",
  );
  assert(
    stats.comingPercentage === percentOf(stats.coming, stats.completed),
    "Coming rate is coming / completed",
  );
  assert(
    stats.completionPercentage === percentOf(stats.completed, stats.totalContacts),
    "Completion is completed / total contacts",
  );
}

function testAssignedUnassignedSplit() {
  const stats = computeContactStatistics(
    [
      {
        id: "a",
        campaign_id: "camp-1",
        latest_response: "COMING",
        assignment_status: "IN_PROGRESS",
        current_assignee_id: "tp-a",
      },
      {
        id: "b",
        campaign_id: "camp-1",
        latest_response: null,
        assignment_status: "UNASSIGNED",
        current_assignee_id: null,
      },
    ],
    1,
  );

  assert(stats.assigned === 1, "Assigned count");
  assert(stats.unassigned === 1, "Unassigned count");
  assert(stats.assigned + stats.unassigned === stats.totalContacts, "Assigned + unassigned = total");
  assert(stats.completed === 1, "Only assigned coming contact is completed");
  assert(stats.remaining === 1, "Unassigned with no response is remaining");
}

function main() {
  testFirstSavesMatchReportCounters();
  testChangingResponseDoesNotDoubleCount();
  testSameResponseSaveIsIdempotent();
  testFailedSaveRestoresOnlyThatCall();
  testFailedFirstSaveRestoresEmptyQueue();
  testSkipDoesNotChangeStats();
  testHeadlineReachedMatchesReportRates();
  testAssignedUnassignedSplit();
  console.log("Stats accuracy tests passed.");
}

main();
