export const DEFAULT_SELF_RETAIN_COUNT = 50;

export function getDefaultRetainCount(
  poolTotal: number,
  canRetain: boolean,
): number {
  if (!canRetain || poolTotal <= 0) {
    return 0;
  }

  return Math.min(DEFAULT_SELF_RETAIN_COUNT, poolTotal);
}

export function computeEqualSplit(
  total: number,
  assigneeIds: string[],
): Map<string, number> {
  const result = new Map<string, number>();

  for (const id of assigneeIds) {
    result.set(id, 0);
  }

  if (assigneeIds.length === 0 || total <= 0) {
    return result;
  }

  const base = Math.floor(total / assigneeIds.length);
  const remainder = total % assigneeIds.length;

  assigneeIds.forEach((id, index) => {
    result.set(id, base + (index < remainder ? 1 : 0));
  });

  return result;
}

export function splitPoolForRetention(
  contactIds: string[],
  retainCount: number,
): { retained: string[]; distributable: string[] } {
  const safeRetainCount = Math.max(
    0,
    Math.min(retainCount, contactIds.length),
  );

  return {
    retained: contactIds.slice(0, safeRetainCount),
    distributable: contactIds.slice(safeRetainCount),
  };
}

export function buildEqualSplitCounts(
  poolTotal: number,
  assigneeIds: string[],
  retainCount: number,
): Record<string, number> {
  const distributableTotal = Math.max(0, poolTotal - retainCount);

  return Object.fromEntries(
    computeEqualSplit(distributableTotal, assigneeIds).entries(),
  );
}

export function partitionContacts(
  contactIds: string[],
  splitMap: Map<string, number>,
  assigneeOrder: string[],
): Array<{ assigneeId: string; contactIds: string[] }> {
  const result: Array<{ assigneeId: string; contactIds: string[] }> = [];
  let offset = 0;

  for (const assigneeId of assigneeOrder) {
    const count = splitMap.get(assigneeId) ?? 0;
    result.push({
      assigneeId,
      contactIds: contactIds.slice(offset, offset + count),
    });
    offset += count;
  }

  return result;
}

export function sumSplitCounts(splitMap: Map<string, number>): number {
  return [...splitMap.values()].reduce((sum, count) => sum + count, 0);
}

export function validateSplitTotals(
  total: number,
  splitMap: Map<string, number>,
): boolean {
  return sumSplitCounts(splitMap) === total;
}

export function validateDistributionTotals(
  poolTotal: number,
  retainCount: number,
  splitMap: Map<string, number>,
): boolean {
  return retainCount + sumSplitCounts(splitMap) === poolTotal;
}
