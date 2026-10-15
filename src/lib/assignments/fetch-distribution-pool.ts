import {
  partitionContactsByCalledStatus,
  type CalledPartition,
} from "@/lib/assignments/called-contacts";
import {
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

async function fetchDownstreamCandidateIds(
  campaignId: string,
  context: AuthorizationContext,
): Promise<string[]> {
  const pool = getDistributionPoolFilter(context);
  const supabase = await createClient();

  if (pool === "unassigned") {
    const contacts = await fetchAllPages<{ id: string }>(async (from, to) =>
      supabase
        .from("contacts")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("assignment_status", "UNASSIGNED")
        .order("name", { ascending: true })
        .range(from, to),
    );
    return contacts.map((contact) => contact.id);
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

  return rows
    .filter((contact) => {
      const assignment = normalizeAssignment(contact.contact_assignments);

      return isContactReadyForDownstreamDistribution(
        contact,
        assignment,
        context.telepastor.id,
        pool,
      );
    })
    .map((contact) => contact.id);
}

export async function partitionDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
): Promise<CalledPartition> {
  const supabase = await createClient();
  const candidateIds = await fetchDownstreamCandidateIds(campaignId, context);
  return partitionContactsByCalledStatus(supabase, candidateIds);
}

/**
 * Count uncalled contacts ready in the actor's distribution pool.
 * Aligns with {@link fetchDistributionPoolContactsForCampaign}.
 */
export async function countDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
): Promise<number> {
  const { uncalledIds } = await partitionDistributionPoolContactsForCampaign(
    campaignId,
    context,
  );
  return uncalledIds.length;
}

export async function fetchDistributionPoolContactsForCampaign(
  campaignId: string,
  context: AuthorizationContext,
) {
  const { uncalledIds } = await partitionDistributionPoolContactsForCampaign(
    campaignId,
    context,
  );
  return uncalledIds.map((id) => ({ id }));
}
