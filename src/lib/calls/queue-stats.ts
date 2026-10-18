import type { CallQueueStats, CallResponse } from "@/types/domain";

const RESPONSE_STAT_KEY: Record<CallResponse, keyof CallQueueStats> = {
  COMING: "coming",
  NOT_COMING: "notComing",
  UNREACHABLE: "unreachable",
  SWITCHED_OFF: "switchedOff",
  WRONG_NUMBER: "wrongNumber",
  OTHER: "other",
};

export function applySavedCallToQueueStats(
  stats: CallQueueStats,
  response: CallResponse,
  options: { wasAlreadyCompleted: boolean },
): CallQueueStats {
  const next: CallQueueStats = { ...stats };

  if (options.wasAlreadyCompleted) {
    return next;
  }

  const bucket = RESPONSE_STAT_KEY[response];
  next[bucket] += 1;
  next.completed += 1;
  next.remaining = Math.max(0, next.remaining - 1);

  return next;
}