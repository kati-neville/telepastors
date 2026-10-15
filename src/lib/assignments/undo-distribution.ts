import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/supabase/errors";
import type { Database, Json } from "@/types/database";
import type { MinistryRole } from "@/types/domain";

export const UNDONE_DISTRIBUTION_RECLAIM_NOTE = "__undone_distribution_reclaim__";
export const UNDO_BLOCKED_HAS_RESPONSE = "has_response";

export type DistributionJobAssigneeSummary = {
  assigneeId: string;
  name: string;
  count: number;
};

export type DistributionJobPlan = {
  chunks?: Array<Array<{ assigneeId: string; contactIds: string[] }>>;
  retainedContactIds?: string[];
  byAssignee?: DistributionJobAssigneeSummary[];
};

export type UndoneAssigneeResult = {
  assigneeId: string;
  name: string;
  reclaimedCount: number;
  blockedCount: number;
  keptCalledCount: number;
  otherBlockedCount: number;
  undoneAt: string;
};

export type DistributionJobSummary = {
  id: string;
  campaignId: string;
  status: "pending" | "running" | "completed" | "failed" | "undone";
  retainCount: number;
  poolTotal: number;
  assignedCount: number;
  completedAt: string | null;
  undoneAt: string | null;
  byAssignee: DistributionJobAssigneeSummary[];
  undoneAssignees: UndoneAssigneeResult[];
};

export type UndoDistributionResult = {
  reclaimedCount: number;
  blockedCount: number;
  keptCalledCount: number;
  otherBlockedCount: number;
  blocked: Array<{ contactId: string; reason: string }>;
};

export function countUndoBlockedByReason(
  blocked: Array<{ reason: string }>,
  blockedCount = blocked.length,
): { keptCalledCount: number; otherBlockedCount: number } {
  const keptCalledCount = blocked.filter(
    (entry) => entry.reason === UNDO_BLOCKED_HAS_RESPONSE,
  ).length;

  return {
    keptCalledCount,
    otherBlockedCount: Math.max(0, blockedCount - keptCalledCount),
  };
}

export function formatUndoAssigneeSummary(params: {
  reclaimedCount: number;
  keptCalledCount: number;
  otherBlockedCount: number;
}): string {
  const parts = [
    `reclaimed ${params.reclaimedCount} uncalled`,
  ];

  if (params.keptCalledCount > 0) {
    parts.push(
      `kept ${params.keptCalledCount} with responses`,
    );
  }

  if (params.otherBlockedCount > 0) {
    parts.push(
      `skipped ${params.otherBlockedCount} already moved`,
    );
  }

  return parts.join(", ");
}

function asUndoneAssigneeResult(
  row: Record<string, unknown>,
  fallbackId = "",
): UndoneAssigneeResult | null {
  const assigneeId = String(row.assigneeId ?? fallbackId);
  if (!assigneeId) {
    return null;
  }

  const blockedCount = Number(row.blockedCount ?? 0);
  const keptCalledCount = Number(row.keptCalledCount ?? 0);
  const otherBlockedCount = Number(
    row.otherBlockedCount ?? Math.max(0, blockedCount - keptCalledCount),
  );

  return {
    assigneeId,
    name: String(row.name ?? "Unknown"),
    reclaimedCount: Number(row.reclaimedCount ?? 0),
    blockedCount,
    keptCalledCount,
    otherBlockedCount,
    undoneAt: String(row.undoneAt ?? ""),
  };
}

function asAssigneeSummary(value: unknown): DistributionJobAssigneeSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const assigneeId = String(row.assigneeId ?? "");
      const name = String(row.name ?? "Unknown");
      const count = Number(row.count ?? 0);
      if (!assigneeId || !Number.isFinite(count)) {
        return null;
      }
      return { assigneeId, name, count };
    })
    .filter((entry): entry is DistributionJobAssigneeSummary => Boolean(entry));
}

function asUndoneAssignees(value: unknown): UndoneAssigneeResult[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value as Record<string, unknown>)
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      return asUndoneAssigneeResult(entry as Record<string, unknown>);
    })
    .filter((entry): entry is UndoneAssigneeResult => Boolean(entry));
}

export function flattenDistributionPlanItems(
  plan: DistributionJobPlan | null | undefined,
  assigneeId?: string,
): Array<{ contact_id: string; expected_assignee_id: string }> {
  const items: Array<{ contact_id: string; expected_assignee_id: string }> = [];
  const chunks = plan?.chunks ?? [];

  for (const chunk of chunks) {
    for (const assignment of chunk) {
      if (assigneeId && assignment.assigneeId !== assigneeId) {
        continue;
      }
      for (const contactId of assignment.contactIds ?? []) {
        items.push({
          contact_id: contactId,
          expected_assignee_id: assignment.assigneeId,
        });
      }
    }
  }

  return items;
}

export function parseUndoResultPayload(value: Json | null | undefined): {
  byAssignee: Record<string, UndoneAssigneeResult>;
  mode?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { byAssignee: {} };
  }

  const row = value as Record<string, unknown>;
  const byAssigneeRaw =
    row.byAssignee && typeof row.byAssignee === "object" && !Array.isArray(row.byAssignee)
      ? (row.byAssignee as Record<string, unknown>)
      : {};

  const byAssignee: Record<string, UndoneAssigneeResult> = {};
  for (const [key, entry] of Object.entries(byAssigneeRaw)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const assigneeId = String(item.assigneeId ?? key);
    const parsed = asUndoneAssigneeResult(item, assigneeId);
    if (parsed) {
      byAssignee[assigneeId] = parsed;
    }
  }

  // Legacy whole-job undo payload without byAssignee — treat as fully undone.
  if (
    Object.keys(byAssignee).length === 0 &&
    typeof row.reclaimedCount === "number"
  ) {
    return { byAssignee: {}, mode: String(row.mode ?? "") };
  }

  return {
    byAssignee,
    mode: typeof row.mode === "string" ? row.mode : undefined,
  };
}

export function mapDistributionJobRow(row: {
  id: string;
  campaign_id: string;
  status: string;
  retain_count: number;
  pool_total: number;
  assigned_count: number;
  completed_at: string | null;
  undone_at?: string | null;
  result: Json | null;
  undo_result?: Json | null;
  plan?: Json | null;
}): DistributionJobSummary {
  const result =
    row.result && typeof row.result === "object" && !Array.isArray(row.result)
      ? (row.result as Record<string, unknown>)
      : null;
  const undoParsed = parseUndoResultPayload(row.undo_result ?? null);

  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as DistributionJobSummary["status"],
    retainCount: row.retain_count,
    poolTotal: row.pool_total,
    assignedCount: row.assigned_count,
    completedAt: row.completed_at,
    undoneAt: row.undone_at ?? null,
    byAssignee: asAssigneeSummary(result?.byAssignee),
    undoneAssignees: asUndoneAssignees(undoParsed.byAssignee),
  };
}

export function getUndoModeForRole(
  role: MinistryRole,
): "reclaim" | "unassign" {
  return role === "SUPER_ADMIN" ? "unassign" : "reclaim";
}

export function buildJobUndoUpdateForAssignee(params: {
  result: Json | null;
  undoResult: Json | null;
  assigneeUndo: UndoneAssigneeResult;
  mode: string;
}): {
  shouldUpdate: boolean;
  undoResultPayload: Record<string, unknown>;
  allAssigneesUndone: boolean;
} {
  const result =
    params.result &&
    typeof params.result === "object" &&
    !Array.isArray(params.result)
      ? (params.result as Record<string, unknown>)
      : null;
  const byAssigneeList = asAssigneeSummary(result?.byAssignee);
  const existingUndo = parseUndoResultPayload(params.undoResult);
  const alreadyUndone = Boolean(
    existingUndo.byAssignee[params.assigneeUndo.assigneeId],
  );
  const assigneeInJob = byAssigneeList.some(
    (entry) => entry.assigneeId === params.assigneeUndo.assigneeId,
  );

  const nextByAssignee = {
    ...existingUndo.byAssignee,
    [params.assigneeUndo.assigneeId]: params.assigneeUndo,
  };
  const undoableAssigneeIds = byAssigneeList
    .filter((entry) => entry.count > 0)
    .map((entry) => entry.assigneeId);
  const allAssigneesUndone =
    undoableAssigneeIds.length > 0 &&
    undoableAssigneeIds.every((id) => Boolean(nextByAssignee[id]));

  return {
    shouldUpdate: assigneeInJob && !alreadyUndone,
    undoResultPayload: {
      byAssignee: nextByAssignee,
      mode: params.mode,
    },
    allAssigneesUndone,
  };
}

const UNDO_CHUNK_SIZE = 400;

export async function reclaimDistributionContacts(
  supabase: SupabaseClient<Database, "public">,
  params: {
    campaignId: string;
    actorId: string;
    mode: "reclaim" | "unassign";
    items: Array<{ contact_id: string; expected_assignee_id: string }>;
  },
): Promise<
  | { success: true; data: UndoDistributionResult }
  | { success: false; error: string }
> {
  const { campaignId, actorId, mode, items } = params;

  if (items.length === 0) {
    return {
      success: true,
      data: {
        reclaimedCount: 0,
        blockedCount: 0,
        keptCalledCount: 0,
        otherBlockedCount: 0,
        blocked: [],
      },
    };
  }

  let reclaimedCount = 0;
  let blockedCount = 0;
  const blocked: Array<{ contactId: string; reason: string }> = [];

  for (let index = 0; index < items.length; index += UNDO_CHUNK_SIZE) {
    const chunk = items.slice(index, index + UNDO_CHUNK_SIZE);
    const { data, error } = await supabase.rpc(
      "undo_distribution_reclaim_contacts",
      {
        p_campaign_id: campaignId,
        p_actor_id: actorId,
        p_mode: mode,
        p_items: chunk,
      },
    );

    if (error) {
      if (
        error.message?.includes("undo_distribution_reclaim_contacts") ||
        error.code === "PGRST202" ||
        error.code === "42883"
      ) {
        return {
          success: false,
          error:
            "Undo is not available until the database migration is applied.",
        };
      }

      return {
        success: false,
        error: formatSupabaseError(error, "Failed to undo distribution."),
      };
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    reclaimedCount += Number(payload.reclaimedCount ?? 0);
    blockedCount += Number(payload.blockedCount ?? 0);

    if (Array.isArray(payload.blocked)) {
      for (const entry of payload.blocked) {
        if (!entry || typeof entry !== "object") continue;
        const row = entry as Record<string, unknown>;
        blocked.push({
          contactId: String(row.contactId ?? ""),
          reason: String(row.reason ?? "blocked"),
        });
      }
    }
  }

  const { keptCalledCount, otherBlockedCount } = countUndoBlockedByReason(
    blocked,
    blockedCount,
  );

  return {
    success: true,
    data: {
      reclaimedCount,
      blockedCount,
      keptCalledCount,
      otherBlockedCount,
      blocked,
    },
  };
}
