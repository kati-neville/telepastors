"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAssignContact,
  canAssignContactToAssignee,
  canDistributeContacts,
  canRetainContactsForCalling,
} from "@/lib/auth/assignments";
import { assignContactToAssignee } from "@/lib/assignments/process-contact-assignment";
import { bulkAssignContactsRpc } from "@/lib/assignments/bulk-assign-contacts-rpc";
import {
  buildBulkDistributionPlan,
  type BulkDistributionChunkAssignment,
} from "@/lib/assignments/bulk-distribution-plan";
import {
  validateDistributionTotals,
} from "@/lib/assignments/distribute-equally";
import { markContactsHeldForOwnCalls } from "@/lib/assignments/retain-for-calling";
import { processDistributionJob } from "@/lib/assignments/process-distribution-job";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import {
  fetchAssigneeById,
  fetchContactsByIds,
  fetchDistributionPoolContactIds,
} from "@/lib/queries/assignments";
import { fetchCampaignById } from "@/lib/queries/campaigns";
import { createClient } from "@/lib/supabase/server";
import {
  assignContactsSchema,
  bulkAssignContactsSchema,
  bulkDistributionChunkSchema,
  finalizeBulkDistributionSchema,
} from "@/lib/validations/assignments";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function getRequestedDistributionTotal(
  retainCount: number,
  assignments: Array<{ count: number }>,
): number {
  return retainCount + assignments.reduce((sum, assignment) => sum + assignment.count, 0);
}

function buildPoolChangedError(
  poolTotal: number,
  requestedTotal: number,
): string {
  return `The distribution pool changed while you were on this page. ${poolTotal} contacts are ready now, but your split totals ${requestedTotal}. Refresh the page to load the latest counts.`;
}

type AssigneeRecord = NonNullable<Awaited<ReturnType<typeof fetchAssigneeById>>>;

async function loadValidatedAssignees(
  context: AuthorizationContext,
  assigneeIds: string[],
): Promise<
  | { success: true; assigneeById: Map<string, AssigneeRecord> }
  | { success: false; error: string }
> {
  const assigneeRecords = await Promise.all(
    assigneeIds.map((assigneeId) => fetchAssigneeById(assigneeId)),
  );

  const assigneeById = new Map<string, AssigneeRecord>();

  for (let index = 0; index < assigneeIds.length; index += 1) {
    const assigneeId = assigneeIds[index]!;
    const assignee = assigneeRecords[index];

    if (!assignee || !assignee.is_active) {
      return {
        success: false,
        error: "One or more assignees were not found or are inactive.",
      };
    }

    if (!canAssignContactToAssignee(context, assignee)) {
      return {
        success: false,
        error: "You cannot assign contacts to one or more ministry members.",
      };
    }

    assigneeById.set(assigneeId, assignee);
  }

  return { success: true, assigneeById };
}

async function executeAssignmentGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  _context: AuthorizationContext,
  params: {
    campaignId: string;
    assignmentGroups: BulkDistributionChunkAssignment[];
    assigneeById: Map<string, AssigneeRecord>;
    assignedBy: string;
    notes?: string | null;
  },
): Promise<
  | {
      success: true;
      assignedCount: number;
      reassignedCount: number;
      byAssignee: Array<{ assigneeId: string; name: string; count: number }>;
    }
  | { success: false; error: string; assignedCount: number }
> {
  const { campaignId, assignmentGroups, assigneeById, assignedBy, notes } =
    params;

  const rpcAssignments = assignmentGroups.flatMap((group) =>
    group.contactIds.map((contactId) => ({
      contact_id: contactId,
      assignee_id: group.assigneeId,
    })),
  );

  if (rpcAssignments.length === 0) {
    return {
      success: true,
      assignedCount: 0,
      reassignedCount: 0,
      byAssignee: [],
    };
  }

  const rpcResult = await bulkAssignContactsRpc(supabase, {
    campaignId,
    assignments: rpcAssignments,
    assignedBy,
    notes,
  });

  if (!rpcResult.success) {
    return {
      success: false,
      error: rpcResult.error,
      assignedCount: 0,
    };
  }

  const byAssignee = assignmentGroups
    .map((group) => ({
      assigneeId: group.assigneeId,
      name: assigneeById.get(group.assigneeId)?.name ?? "Unknown",
      count: group.contactIds.length,
    }))
    .filter((entry) => entry.count > 0);

  return {
    success: true,
    assignedCount: rpcResult.data.assigned_count,
    reassignedCount: rpcResult.data.reassigned_count,
    byAssignee,
  };
}

function mergeAssigneeCounts(
  totals: Array<{ assigneeId: string; name: string; count: number }>,
  chunkCounts: Array<{ assigneeId: string; name: string; count: number }>,
) {
  const merged = new Map(totals.map((item) => [item.assigneeId, { ...item }]));

  for (const item of chunkCounts) {
    const existing = merged.get(item.assigneeId);
    if (existing) {
      existing.count += item.count;
      continue;
    }

    merged.set(item.assigneeId, { ...item });
  }

  return [...merged.values()];
}

function revalidateAssignmentPaths(campaignId: string) {
  revalidatePath("/assignments");
  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/my-calls");
  revalidatePath("/my-calls/queue");
  revalidatePath("/my-calls/list");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/distribute`);
}

export async function assignContactsAction(
  values: unknown,
): Promise<ActionResult<{ assignedCount: number }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = assignContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment request.",
    };
  }

  const { campaignId, contactIds, assigneeId, notes } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const assignee = await fetchAssigneeById(assigneeId);
  if (!assignee || !assignee.is_active) {
    return { success: false, error: "Assignee not found or inactive." };
  }

  if (!canAssignContactToAssignee(context, assignee)) {
    return {
      success: false,
      error: "You cannot assign contacts to this ministry member.",
    };
  }

  const contacts = await fetchContactsByIds(contactIds);

  if (contacts.length !== contactIds.length) {
    return { success: false, error: "One or more contacts were not found." };
  }

  const invalidContacts = contacts.filter(
    (contact) =>
      contact.campaign_id !== campaignId ||
      !canAssignContact(context, contact),
  );

  if (invalidContacts.length > 0) {
    return {
      success: false,
      error: "You cannot assign one or more of the selected contacts.",
    };
  }

  const supabase = await createClient();
  let assignedCount = 0;
  let reassignedCount = 0;

  for (const contact of contacts) {
    const result = await assignContactToAssignee(supabase, {
      contact,
      assignee,
      campaignId,
      assignedBy: session.telepastor.id,
      notes,
    });

    if (!result.success) {
      return result;
    }

    assignedCount += 1;
    if (result.isReassignment) {
      reassignedCount += 1;
    }
  }

  revalidateAssignmentPaths(campaignId);

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action:
      reassignedCount > 0
        ? AUDIT_ACTIONS.CONTACTS_REASSIGNED
        : AUDIT_ACTIONS.CONTACTS_ASSIGNED,
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      assigneeId,
      assigneeName: assignee.name,
      assignedCount,
      reassignedCount,
      contactIds,
    },
  });

  return {
    success: true,
    data: { assignedCount },
  };
}

export async function bulkAssignContactsAction(
  values: unknown,
): Promise<
  ActionResult<{
    assignedCount: number;
    byAssignee: Array<{ assigneeId: string; name: string; count: number }>;
  }>
> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = bulkAssignContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk assignment request.",
    };
  }

  const { campaignId, assignments, notes, retainCount = 0 } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const actorCanRetain = canRetainContactsForCalling(context.telepastor.role);
  if (retainCount > 0 && !actorCanRetain) {
    return {
      success: false,
      error: "You cannot retain contacts for your own calling.",
    };
  }

  const poolContactIds = await fetchDistributionPoolContactIds(
    campaignId,
    context,
  );

  if (poolContactIds.length === 0) {
    return {
      success: false,
      error: "No contacts are ready to assign.",
    };
  }

  if (retainCount > poolContactIds.length) {
    return {
      success: false,
      error: `You can retain at most ${poolContactIds.length} contacts.`,
    };
  }

  const splitMap = new Map(
    assignments.map((assignment) => [assignment.assigneeId, assignment.count]),
  );

  const requestedTotal = getRequestedDistributionTotal(retainCount, assignments);

  if (requestedTotal !== poolContactIds.length) {
    return {
      success: false,
      error: buildPoolChangedError(poolContactIds.length, requestedTotal),
    };
  }

  if (!validateDistributionTotals(poolContactIds.length, retainCount, splitMap)) {
    return {
      success: false,
      error: `Retained and assigned counts must total ${poolContactIds.length} contacts.`,
    };
  }

  const assigneeIds = assignments.map((assignment) => assignment.assigneeId);
  const assigneeResult = await loadValidatedAssignees(context, assigneeIds);

  if (!assigneeResult.success) {
    return assigneeResult;
  }

  const plan = buildBulkDistributionPlan(
    poolContactIds,
    retainCount,
    splitMap,
    assigneeIds,
  );

  const supabase = await createClient();
  let assignedCount = 0;
  let reassignedCount = 0;
  let byAssignee: Array<{ assigneeId: string; name: string; count: number }> =
    [];

  for (const chunk of plan.chunks) {
    const chunkResult = await executeAssignmentGroups(supabase, context, {
      campaignId,
      assignmentGroups: chunk,
      assigneeById: assigneeResult.assigneeById,
      assignedBy: session.telepastor.id,
      notes,
    });

    if (!chunkResult.success) {
      return {
        success: false,
        error: chunkResult.error,
      };
    }

    assignedCount += chunkResult.assignedCount;
    reassignedCount += chunkResult.reassignedCount;
    byAssignee = mergeAssigneeCounts(byAssignee, chunkResult.byAssignee);
  }

  if (plan.retainedContactIds.length > 0) {
    const retainResult = await markContactsHeldForOwnCalls(supabase, {
      contactIds: plan.retainedContactIds,
      actorId: session.telepastor.id,
      campaignId,
    });

    if (!retainResult.success) {
      return {
        success: false,
        error:
          assignedCount > 0
            ? `${retainResult.error} ${assignedCount} contacts were assigned before the error.`
            : retainResult.error,
      };
    }
  }

  revalidateAssignmentPaths(campaignId);

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.CONTACTS_BULK_ASSIGNED,
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      assignedCount,
      reassignedCount,
      retainCount,
      poolTotal: poolContactIds.length,
      byAssignee,
    },
  });

  return {
    success: true,
    data: {
      assignedCount,
      byAssignee,
    },
  };
}

export async function prepareBulkDistributionAction(
  values: unknown,
): Promise<
  ActionResult<{
    chunks: BulkDistributionChunkAssignment[][];
    retainedContactIds: string[];
    poolTotal: number;
    distributableTotal: number;
    assigneeSummary: Array<{ assigneeId: string; name: string; count: number }>;
  }>
> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = bulkAssignContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk assignment request.",
    };
  }

  const { campaignId, assignments, retainCount = 0 } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const actorCanRetain = canRetainContactsForCalling(context.telepastor.role);
  if (retainCount > 0 && !actorCanRetain) {
    return {
      success: false,
      error: "You cannot retain contacts for your own calling.",
    };
  }

  const poolContactIds = await fetchDistributionPoolContactIds(
    campaignId,
    context,
  );

  if (poolContactIds.length === 0) {
    return {
      success: false,
      error: "No contacts are ready to assign.",
    };
  }

  if (retainCount > poolContactIds.length) {
    return {
      success: false,
      error: `You can retain at most ${poolContactIds.length} contacts.`,
    };
  }

  const splitMap = new Map(
    assignments.map((assignment) => [assignment.assigneeId, assignment.count]),
  );

  const requestedTotal = getRequestedDistributionTotal(retainCount, assignments);

  if (requestedTotal !== poolContactIds.length) {
    return {
      success: false,
      error: buildPoolChangedError(poolContactIds.length, requestedTotal),
    };
  }

  let plan;
  try {
    plan = buildBulkDistributionPlan(
      poolContactIds,
      retainCount,
      splitMap,
      assignments.map((assignment) => assignment.assigneeId),
    );
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Distribution totals do not match the available contacts.",
    };
  }

  const assigneeResult = await loadValidatedAssignees(
    context,
    assignments.map((assignment) => assignment.assigneeId),
  );

  if (!assigneeResult.success) {
    return assigneeResult;
  }

  const assigneeSummary = assignments.map((assignment) => ({
    assigneeId: assignment.assigneeId,
    name: assigneeResult.assigneeById.get(assignment.assigneeId)?.name ?? "Unknown",
    count: assignment.count,
  }));

  return {
    success: true,
    data: {
      chunks: plan.chunks,
      retainedContactIds: plan.retainedContactIds,
      poolTotal: plan.poolTotal,
      distributableTotal: plan.distributableTotal,
      assigneeSummary,
    },
  };
}

export async function executeBulkDistributionChunkAction(
  values: unknown,
): Promise<
  ActionResult<{
    assignedCount: number;
    reassignedCount: number;
    byAssignee: Array<{ assigneeId: string; name: string; count: number }>;
  }>
> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = bulkDistributionChunkSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid distribution chunk.",
    };
  }

  const { campaignId, assignments, notes } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const assigneeIds = assignments.map((assignment) => assignment.assigneeId);
  const assigneeResult = await loadValidatedAssignees(context, assigneeIds);

  if (!assigneeResult.success) {
    return assigneeResult;
  }

  const supabase = await createClient();
  const chunkResult = await executeAssignmentGroups(supabase, context, {
    campaignId,
    assignmentGroups: assignments,
    assigneeById: assigneeResult.assigneeById,
    assignedBy: session.telepastor.id,
    notes,
  });

  if (!chunkResult.success) {
    return {
      success: false,
      error: chunkResult.error,
    };
  }

  return {
    success: true,
    data: {
      assignedCount: chunkResult.assignedCount,
      reassignedCount: chunkResult.reassignedCount,
      byAssignee: chunkResult.byAssignee,
    },
  };
}

export async function finalizeBulkDistributionAction(
  values: unknown,
): Promise<ActionResult<{ assignedCount: number }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const parsed = finalizeBulkDistributionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid distribution summary.",
    };
  }

  const {
    campaignId,
    retainedContactIds,
    poolTotal,
    retainCount,
    assignedCount,
    reassignedCount,
    byAssignee,
    notes,
  } = parsed.data;

  const campaign = await fetchCampaignById(campaignId);
  if (!campaign) {
    return { success: false, error: "Campaign not found." };
  }

  const supabase = await createClient();

  if (retainedContactIds.length > 0) {
    const retainResult = await markContactsHeldForOwnCalls(supabase, {
      contactIds: retainedContactIds,
      actorId: session.telepastor.id,
      campaignId,
    });

    if (!retainResult.success) {
      return {
        success: false,
        error:
          assignedCount > 0
            ? `${retainResult.error} ${assignedCount} contacts were assigned before the error.`
            : retainResult.error,
      };
    }
  }

  revalidateAssignmentPaths(campaignId);

  await recordAuditEvent({
    actorId: session.telepastor.id,
    action: AUDIT_ACTIONS.CONTACTS_BULK_ASSIGNED,
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      assignedCount,
      reassignedCount,
      retainCount,
      poolTotal,
      byAssignee,
      notes: notes ?? null,
    },
  });

  return {
    success: true,
    data: { assignedCount },
  };
}

export async function startDistributionJobAction(
  values: unknown,
): Promise<ActionResult<{ jobId: string }>> {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    return {
      success: false,
      error: "You are not allowed to assign contacts.",
    };
  }

  const prepared = await prepareBulkDistributionAction(values);
  if (!prepared.success) {
    return { success: false, error: prepared.error };
  }

  if (!prepared.data) {
    return { success: false, error: "Failed to prepare distribution." };
  }

  const {
    chunks,
    retainedContactIds,
    poolTotal,
    distributableTotal,
    assigneeSummary,
  } = prepared.data;

  const parsed = bulkAssignContactsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk assignment request.",
    };
  }

  const { campaignId, retainCount = 0 } = parsed.data;
  const supabase = await createClient();

  const { data: job, error: insertError } = await supabase
    .from("distribution_jobs")
    .insert({
      campaign_id: campaignId,
      actor_id: session.telepastor.id,
      status: "pending",
      retain_count: retainCount,
      pool_total: poolTotal,
      progress_total:
        distributableTotal > 0 ? distributableTotal : retainedContactIds.length,
      plan: {
        chunks,
        retainedContactIds,
        byAssignee: assigneeSummary,
      },
    })
    .select("id")
    .single();

  if (insertError || !job) {
    return {
      success: false,
      error: insertError?.message ?? "Failed to start distribution job.",
    };
  }

  after(async () => {
    await processDistributionJob(job.id);
    revalidateAssignmentPaths(campaignId);
  });

  return {
    success: true,
    data: { jobId: job.id },
  };
}

export async function getDistributionJobStatusAction(
  jobId: string,
): Promise<
  ActionResult<{
    status: "pending" | "running" | "completed" | "failed";
    progressCompleted: number;
    progressTotal: number;
    assignedCount: number;
    errorMessage: string | null;
    byAssignee: Array<{ assigneeId: string; name: string; count: number }>;
  }>
> {
  const session = await requireAuthSession();
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("distribution_jobs")
    .select(
      "status, progress_completed, progress_total, assigned_count, error_message, result, actor_id",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!job || job.actor_id !== session.telepastor.id) {
    return { success: false, error: "Distribution job not found." };
  }

  const result = job.result as
    | { byAssignee?: Array<{ assigneeId: string; name: string; count: number }> }
    | null;

  return {
    success: true,
    data: {
      status: job.status as "pending" | "running" | "completed" | "failed",
      progressCompleted: job.progress_completed,
      progressTotal: job.progress_total,
      assignedCount: job.assigned_count,
      errorMessage: job.error_message,
      byAssignee: result?.byAssignee ?? [],
    },
  };
}

export async function requireCampaignDistributionAccess(campaignId: string) {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    redirect("/dashboard");
  }

  const campaign = await fetchCampaignById(campaignId);

  if (!campaign) {
    redirect(context.telepastor.role === "LEADER" ? "/assignments" : "/campaigns");
  }

  if (context.telepastor.role === "LEADER") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("current_assignee_id", session.telepastor.id);

    if (!count) {
      redirect("/assignments");
    }
  } else if (
    context.telepastor.role === "GOVERNOR" ||
    context.telepastor.role === "SUPER_ADMIN"
  ) {
    if (!canDistributeContacts(context)) {
      redirect("/campaigns");
    }
  }

  return { session, campaign, context };
}

export async function requireAssignmentsAccess() {
  const session = await requireAuthSession();
  const context = { telepastor: session.telepastor };

  if (!canDistributeContacts(context)) {
    redirect("/dashboard");
  }

  return { session, context };
}
