"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAssignContact,
  canAssignContactToAssignee,
  canDistributeContacts,
  canRetainContactsForCalling,
} from "@/lib/auth/assignments";
import { assignContactToAssignee } from "@/lib/assignments/process-contact-assignment";
import {
  partitionContacts,
  splitPoolForRetention,
  validateDistributionTotals,
} from "@/lib/assignments/distribute-equally";
import { markContactsHeldForOwnCalls } from "@/lib/assignments/retain-for-calling";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { recordAuditEvent } from "@/lib/audit/log";
import { requireAuthSession } from "@/lib/auth/session";
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
} from "@/lib/validations/assignments";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const ASSIGNMENT_BATCH_SIZE = 500;

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

  if (!validateDistributionTotals(poolContactIds.length, retainCount, splitMap)) {
    return {
      success: false,
      error: `Retained and assigned counts must total ${poolContactIds.length} contacts.`,
    };
  }

  const { retained, distributable: distributableContactIds } =
    splitPoolForRetention(poolContactIds, retainCount);

  const assigneeIds = assignments.map((assignment) => assignment.assigneeId);
  const assigneeRecords = await Promise.all(
    assigneeIds.map((assigneeId) => fetchAssigneeById(assigneeId)),
  );

  const assigneeById = new Map<
    string,
    NonNullable<(typeof assigneeRecords)[number]>
  >();

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

  const partitions = partitionContacts(
    distributableContactIds,
    splitMap,
    assigneeIds,
  ).filter((partition) => partition.contactIds.length > 0);

  const supabase = await createClient();
  let assignedCount = 0;
  let reassignedCount = 0;
  const byAssignee: Array<{
    assigneeId: string;
    name: string;
    count: number;
  }> = [];

  for (const partition of partitions) {
    const assignee = assigneeById.get(partition.assigneeId);
    if (!assignee) {
      continue;
    }

    let partitionAssigned = 0;

    for (let index = 0; index < partition.contactIds.length; index += ASSIGNMENT_BATCH_SIZE) {
      const batchIds = partition.contactIds.slice(
        index,
        index + ASSIGNMENT_BATCH_SIZE,
      );
      const contacts = await fetchContactsByIds(batchIds);

      if (contacts.length !== batchIds.length) {
        return {
          success: false,
          error: "One or more contacts were not found during bulk assignment.",
        };
      }

      const invalidContacts = contacts.filter(
        (contact) =>
          contact.campaign_id !== campaignId ||
          !canAssignContact(context, contact),
      );

      if (invalidContacts.length > 0) {
        return {
          success: false,
          error: "You cannot assign one or more contacts in this distribution.",
        };
      }

      for (const contact of contacts) {
        const result = await assignContactToAssignee(supabase, {
          contact,
          assignee,
          campaignId,
          assignedBy: session.telepastor.id,
          notes,
        });

        if (!result.success) {
          return {
            success: false,
            error:
              assignedCount > 0
                ? `${result.error} ${assignedCount} contacts were assigned before the error.`
                : result.error,
          };
        }

        assignedCount += 1;
        partitionAssigned += 1;
        if (result.isReassignment) {
          reassignedCount += 1;
        }
      }
    }

    byAssignee.push({
      assigneeId: assignee.id,
      name: assignee.name,
      count: partitionAssigned,
    });
  }

  if (retained.length > 0) {
    const retainResult = await markContactsHeldForOwnCalls(supabase, {
      contactIds: retained,
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
