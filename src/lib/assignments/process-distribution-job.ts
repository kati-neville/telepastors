import { bulkAssignContactsRpc } from "@/lib/assignments/bulk-assign-contacts-rpc";
import type { BulkDistributionChunkAssignment } from "@/lib/assignments/bulk-distribution-plan";
import { countContactsInChunk } from "@/lib/assignments/bulk-distribution-plan";
import { markContactsHeldForOwnCalls } from "@/lib/assignments/retain-for-calling";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";

type StoredDistributionPlan = {
  chunks: BulkDistributionChunkAssignment[][];
  retainedContactIds: string[];
  byAssignee: Array<{ assigneeId: string; name: string; count: number }>;
};

type DistributionJobRow = {
  id: string;
  campaign_id: string;
  actor_id: string;
  status: string;
  retain_count: number;
  pool_total: number;
  assigned_count: number;
  reassigned_count: number;
  progress_completed: number;
  progress_total: number;
  plan: StoredDistributionPlan;
  error_message: string | null;
};

function flattenChunkAssignments(
  chunk: BulkDistributionChunkAssignment[],
): Array<{ contact_id: string; assignee_id: string }> {
  return chunk.flatMap((group) =>
    group.contactIds.map((contactId) => ({
      contact_id: contactId,
      assignee_id: group.assigneeId,
    })),
  );
}

export async function processDistributionJob(jobId: string) {
  const supabase = await createClient();

  const { data: job, error: loadError } = await supabase
    .from("distribution_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!job || job.status === "completed" || job.status === "failed") {
    return;
  }

  const typedJob = job as unknown as DistributionJobRow;
  const plan = typedJob.plan;

  await supabase
    .from("distribution_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);

  let assignedCount = 0;
  let reassignedCount = 0;
  let progressCompleted = 0;

  try {
    for (const chunk of plan.chunks) {
      const rpcResult = await bulkAssignContactsRpc(supabase, {
        campaignId: typedJob.campaign_id,
        assignments: flattenChunkAssignments(chunk),
        assignedBy: typedJob.actor_id,
      });

      if (!rpcResult.success) {
        throw new Error(rpcResult.error);
      }

      assignedCount += rpcResult.data.assigned_count;
      reassignedCount += rpcResult.data.reassigned_count;
      progressCompleted += countContactsInChunk(chunk);

      await supabase
        .from("distribution_jobs")
        .update({
          assigned_count: assignedCount,
          reassigned_count: reassignedCount,
          progress_completed: progressCompleted,
        })
        .eq("id", jobId);
    }

    if (plan.retainedContactIds.length > 0) {
      const retainResult = await markContactsHeldForOwnCalls(supabase, {
        contactIds: plan.retainedContactIds,
        actorId: typedJob.actor_id,
        campaignId: typedJob.campaign_id,
      });

      if (!retainResult.success) {
        throw new Error(retainResult.error);
      }
    }

    await recordAuditEvent({
      actorId: typedJob.actor_id,
      action: AUDIT_ACTIONS.CONTACTS_BULK_ASSIGNED,
      entityType: "campaign",
      entityId: typedJob.campaign_id,
      metadata: {
        assignedCount,
        reassignedCount,
        retainCount: typedJob.retain_count,
        poolTotal: typedJob.pool_total,
        byAssignee: plan.byAssignee,
        jobId,
      },
    });

    await supabase
      .from("distribution_jobs")
      .update({
        status: "completed",
        assigned_count: assignedCount,
        reassigned_count: reassignedCount,
        progress_completed: typedJob.progress_total,
        completed_at: new Date().toISOString(),
        result: {
          assignedCount,
          reassignedCount,
          byAssignee: plan.byAssignee,
        },
        error_message: null,
      })
      .eq("id", jobId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Distribution failed unexpectedly.";

    await supabase
      .from("distribution_jobs")
      .update({
        status: "failed",
        assigned_count: assignedCount,
        reassigned_count: reassignedCount,
        progress_completed: progressCompleted,
        completed_at: new Date().toISOString(),
        error_message:
          assignedCount > 0
            ? `${message} ${assignedCount} contacts were assigned before the error.`
            : message,
      })
      .eq("id", jobId);
  }
}
