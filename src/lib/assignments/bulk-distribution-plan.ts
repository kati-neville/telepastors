import {
  partitionContacts,
  splitPoolForRetention,
  validateDistributionTotals,
} from "@/lib/assignments/distribute-equally";

export const DISTRIBUTION_CHUNK_SIZE = 500;

export type BulkDistributionChunkAssignment = {
  assigneeId: string;
  contactIds: string[];
};

export type BulkDistributionPlan = {
  chunks: BulkDistributionChunkAssignment[][];
  retainedContactIds: string[];
  poolTotal: number;
  distributableTotal: number;
};

export function buildBulkDistributionPlan(
  poolContactIds: string[],
  retainCount: number,
  splitMap: Map<string, number>,
  assigneeOrder: string[],
  chunkSize = DISTRIBUTION_CHUNK_SIZE,
): BulkDistributionPlan {
  if (
    !validateDistributionTotals(poolContactIds.length, retainCount, splitMap)
  ) {
    throw new Error(
      `Retained and assigned counts must total ${poolContactIds.length} contacts.`,
    );
  }

  const { retained, distributable } = splitPoolForRetention(
    poolContactIds,
    retainCount,
  );

  const partitions = partitionContacts(distributable, splitMap, assigneeOrder);
  const chunks = chunkPartitionedContacts(partitions, chunkSize);

  return {
    chunks,
    retainedContactIds: retained,
    poolTotal: poolContactIds.length,
    distributableTotal: distributable.length,
  };
}

export function chunkPartitionedContacts(
  partitions: Array<{ assigneeId: string; contactIds: string[] }>,
  chunkSize: number,
): BulkDistributionChunkAssignment[][] {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than zero.");
  }

  const pairs: Array<{ assigneeId: string; contactId: string }> = [];

  for (const partition of partitions) {
    for (const contactId of partition.contactIds) {
      pairs.push({ assigneeId: partition.assigneeId, contactId });
    }
  }

  const chunks: BulkDistributionChunkAssignment[][] = [];

  for (let index = 0; index < pairs.length; index += chunkSize) {
    const slice = pairs.slice(index, index + chunkSize);
    const byAssignee = new Map<string, string[]>();

    for (const { assigneeId, contactId } of slice) {
      const existing = byAssignee.get(assigneeId) ?? [];
      existing.push(contactId);
      byAssignee.set(assigneeId, existing);
    }

    chunks.push(
      [...byAssignee.entries()].map(([assigneeId, contactIds]) => ({
        assigneeId,
        contactIds,
      })),
    );
  }

  return chunks;
}

export function countContactsInChunk(
  chunk: BulkDistributionChunkAssignment[],
): number {
  return chunk.reduce((sum, assignment) => sum + assignment.contactIds.length, 0);
}

export function countContactsInPlan(plan: BulkDistributionPlan): number {
  return plan.chunks.reduce(
    (sum, chunk) => sum + countContactsInChunk(chunk),
    0,
  );
}
