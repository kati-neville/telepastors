import { computeContactStatistics } from "@/lib/stats/compute";
import type { CallQueueStats, CallResponse } from "@/types/domain";

const RESPONSE_STAT_KEY: Record<CallResponse, keyof CallQueueStats> = {
  COMING: "coming",
  NOT_COMING: "notComing",
  UNREACHABLE: "unreachable",
  SWITCHED_OFF: "switchedOff",
  WRONG_NUMBER: "wrongNumber",
  OTHER: "other",
};

function withRemaining(stats: CallQueueStats): CallQueueStats {
  return {
    ...stats,
    remaining: Math.max(0, stats.assigned - stats.completed),
  };
}

/**
 * Same rules as report counters: latest_response is unique per contact.
 * First save moves remaining → completed and increments the response bucket.
 * Changing a saved response swaps buckets and does not recount completed.
 */
export function applySavedCallToQueueStats(
  stats: CallQueueStats,
  response: CallResponse,
  options: { previousResponse: CallResponse | null },
): CallQueueStats {
  const previous = options.previousResponse;
  if (previous === response) {
    return { ...stats };
  }

  const next: CallQueueStats = { ...stats };

  if (previous) {
    const previousKey = RESPONSE_STAT_KEY[previous];
    next[previousKey] = Math.max(0, next[previousKey] - 1);
  } else {
    next.completed += 1;
  }

  next[RESPONSE_STAT_KEY[response]] += 1;
  return withRemaining(next);
}

export function revertSavedCallOnQueueStats(
  stats: CallQueueStats,
  response: CallResponse,
  options: { previousResponse: CallResponse | null },
): CallQueueStats {
  const previous = options.previousResponse;
  if (previous === response) {
    return { ...stats };
  }

  const next: CallQueueStats = { ...stats };
  const responseKey = RESPONSE_STAT_KEY[response];
  next[responseKey] = Math.max(0, next[responseKey] - 1);

  if (previous) {
    next[RESPONSE_STAT_KEY[previous]] += 1;
  } else {
    next.completed = Math.max(0, next.completed - 1);
  }

  return withRemaining(next);
}

export function callQueueStatsFromResponses(
  responses: Array<CallResponse | null>,
): CallQueueStats {
  const computed = computeContactStatistics(
    responses.map((latest_response, index) => ({
      id: `contact-${index}`,
      campaign_id: "campaign",
      latest_response,
      assignment_status: latest_response ? "IN_PROGRESS" : "ASSIGNED",
      current_assignee_id: "assignee",
    })),
  );

  return {
    assigned: computed.assigned,
    completed: computed.completed,
    remaining: computed.remaining,
    coming: computed.coming,
    notComing: computed.notComing,
    unreachable: computed.unreachable,
    switchedOff: computed.switchedOff,
    wrongNumber: computed.wrongNumber,
    other: computed.other,
  };
}
