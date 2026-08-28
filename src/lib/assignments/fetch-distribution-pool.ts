import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isContactReadyForDownstreamDistribution,
  type DistributionAssignmentSnapshot,
} from "@/lib/assignments/distribution-pool";
import { markContactsHeldForOwnCalls } from "@/lib/assignments/retain-for-calling";
import { getDistributionPoolFilter } from "@/lib/auth/assignments";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PoolContactRow = {
  id: string;
  assignment_status: string;
  current_assignee_id: string | null;
  held_for_own_calls: boolean;
  contact_assignments:
    | DistributionAssignmentSnapshot
    | DistributionAssignmentSnapshot[]
    | null;
};

function normalizeAssignment(
  assignment: PoolContactRow["contact_assignments"],
): DistributionAssignmentSnapshot | null {
  if (!assignment) {
    return null;
  }

  if (Array.isArray(assignment)) {
    return assignment[0] ?? null;
  }

  return assignment;
}

type BulkAssignAuditMetadata = {
  assignedCount?: number;
  retainCount?: number;
  poolTotal?: number;
};

async function getLatestBulkAssignAudit(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  actorId: string,
) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("metadata")
    .eq("actor_id", actorId)
    .eq("entity_type", "campaign")
    .eq("entity_id", campaignId)
    .eq("action", "contacts.bulk_assigned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.metadata || typeof data.metadata !== "object") {
    return null;
  }

  return data.metadata as BulkAssignAuditMetadata;
}

async function fetchUpstreamPoolContactIds(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  context: AuthorizationContext,
) {
  const pool = getDistributionPoolFilter(context);
  if (pool === "unassigned") {
    return [];
  }

  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      assignment_status,
      current_assignee_id,
      held_for_own_calls,
      contact_assignments!contacts_current_assignment_id_fkey (
        assigned_by,
        assignee_id,
        notes
      )
    `,
    )
    .eq("campaign_id", campaignId)
    .eq("current_assignee_id", context.telepastor.id)
    .eq("held_for_own_calls", false)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((contact) => {
      const assignment = normalizeAssignment(
        (contact as PoolContactRow).contact_assignments,
      );

      return isContactReadyForDownstreamDistribution(
        contact as PoolContactRow,
        assignment,
        context.telepastor.id,
        pool,
      );
    })
    .map((contact) => contact.id);
}

async function repairRetainedContactsFromAudit(
  campaignId: string,
  context: AuthorizationContext,
  supabase: SupabaseClient<Database>,
) {
  const pool = getDistributionPoolFilter(context);
  if (pool === "unassigned") {
    return;
  }

  const latestAudit = await getLatestBulkAssignAudit(
    supabase,
    campaignId,
    context.telepastor.id,
  );

  if (!latestAudit || (latestAudit.retainCount ?? 0) <= 0) {
    return;
  }

  const retainCount = latestAudit.retainCount ?? 0;
  const assignedCount = latestAudit.assignedCount ?? 0;
  const poolTotal = latestAudit.poolTotal;
  const upstreamIds = await fetchUpstreamPoolContactIds(
    supabase,
    campaignId,
    context,
  );

  if (upstreamIds.length === 0) {
    return;
  }

  let contactIdsToMark: string[] = [];

  if (assignedCount === 0 && retainCount === upstreamIds.length) {
    contactIdsToMark = upstreamIds;
  } else if (
    typeof poolTotal === "number" &&
    assignedCount + retainCount === poolTotal
  ) {
    contactIdsToMark = upstreamIds.slice(
      0,
      Math.min(retainCount, upstreamIds.length),
    );
  }

  if (contactIdsToMark.length === 0) {
    return;
  }

  await markContactsHeldForOwnCalls(supabase, {
    contactIds: contactIdsToMark,
    actorId: context.telepastor.id,
    campaignId,
  });
}

export async function fetchDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
) {
  const pool = getDistributionPoolFilter(context);
  const supabase = await createClient();

  if (pool === "unassigned") {
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("assignment_status", "UNASSIGNED")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  }

  await repairRetainedContactsFromAudit(campaignId, context, supabase);

  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      assignment_status,
      current_assignee_id,
      held_for_own_calls,
      contact_assignments!contacts_current_assignment_id_fkey (
        assigned_by,
        assignee_id,
        notes
      )
    `,
    )
    .eq("campaign_id", campaignId)
    .eq("current_assignee_id", context.telepastor.id)
    .eq("held_for_own_calls", false)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).filter((contact) => {
    const assignment = normalizeAssignment(
      (contact as PoolContactRow).contact_assignments,
    );

    return isContactReadyForDownstreamDistribution(
      contact as PoolContactRow,
      assignment,
      context.telepastor.id,
      pool,
    );
  });
}
