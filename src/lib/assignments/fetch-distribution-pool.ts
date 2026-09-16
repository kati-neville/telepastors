import {
  RETAINED_FOR_CALLING_NOTE,
  isContactReadyForDownstreamDistribution,
  type DistributionAssignmentSnapshot,
} from "@/lib/assignments/distribution-pool";
import { getDistributionPoolFilter } from "@/lib/auth/assignments";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createClient } from "@/lib/supabase/server";

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

/**
 * Count contacts ready in the actor's distribution pool without loading rows.
 * Aligns with {@link fetchDistributionPoolContactsForCampaign} readiness rules.
 */
export async function countDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
): Promise<number> {
  const pool = getDistributionPoolFilter(context);
  const supabase = await createClient();

  if (pool === "unassigned") {
    const { count, error } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("assignment_status", "UNASSIGNED");

    if (error) {
      throw new Error(error.message);
    }

    return count ?? 0;
  }

  const actorId = context.telepastor.id;

  // Assigned to actor, not held, has a current assignment from someone else
  // (self-retain uses assigned_by = actor). Retained-note leftovers excluded.
  const { count, error } = await supabase
    .from("contacts")
    .select(
      `
      id,
      contact_assignments!contacts_current_assignment_id_fkey!inner (
        assigned_by,
        notes
      )
    `,
      { count: "exact", head: true },
    )
    .eq("campaign_id", campaignId)
    .eq("current_assignee_id", actorId)
    .eq("held_for_own_calls", false)
    .not("contact_assignments.assigned_by", "eq", actorId)
    .or(
      `notes.is.null,notes.not.ilike.%${RETAINED_FOR_CALLING_NOTE}%`,
      { referencedTable: "contact_assignments" },
    );

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function fetchDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
) {
  const pool = getDistributionPoolFilter(context);
  const supabase = await createClient();

  if (pool === "unassigned") {
    return fetchAllPages<{ id: string }>(async (from, to) =>
      supabase
        .from("contacts")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("assignment_status", "UNASSIGNED")
        .order("name", { ascending: true })
        .range(from, to),
    );
  }

  const rows = await fetchAllPages<PoolContactRow>(async (from, to) =>
    supabase
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
      .order("name", { ascending: true })
      .range(from, to),
  );

  return rows.filter((contact) => {
    const assignment = normalizeAssignment(contact.contact_assignments);

    return isContactReadyForDownstreamDistribution(
      contact,
      assignment,
      context.telepastor.id,
      pool,
    );
  });
}
