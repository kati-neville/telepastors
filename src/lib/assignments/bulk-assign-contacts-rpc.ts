import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type BulkAssignContactItem = {
  contact_id: string;
  assignee_id: string;
};

export type BulkAssignContactsResult = {
  assigned_count: number;
  reassigned_count: number;
};

export async function bulkAssignContactsRpc(
  supabase: SupabaseClient<Database>,
  params: {
    campaignId: string;
    assignments: BulkAssignContactItem[];
    assignedBy: string;
    notes?: string | null;
  },
): Promise<
  | { success: true; data: BulkAssignContactsResult }
  | { success: false; error: string }
> {
  const { campaignId, assignments, assignedBy, notes } = params;

  if (assignments.length === 0) {
    return {
      success: true,
      data: { assigned_count: 0, reassigned_count: 0 },
    };
  }

  const { data, error } = await supabase.rpc("bulk_assign_contacts", {
    p_campaign_id: campaignId,
    p_assignments: assignments,
    p_assigned_by: assignedBy,
    p_notes: notes ?? null,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const payload = data as Record<string, unknown> | null;
  const assignedCount =
    typeof payload?.assigned_count === "number" ? payload.assigned_count : 0;
  const reassignedCount =
    typeof payload?.reassigned_count === "number" ? payload.reassigned_count : 0;

  return {
    success: true,
    data: {
      assigned_count: assignedCount,
      reassigned_count: reassignedCount,
    },
  };
}
