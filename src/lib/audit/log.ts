import "server-only";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import type { AuditAction } from "@/lib/audit/types";

export type RecordAuditEventInput = {
  actorId: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(input: RecordAuditEventInput) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });

    if (error) {
      console.error("[audit] Failed to record event:", input.action, error.message);
    }
  } catch (error) {
    console.error("[audit] Unexpected failure:", input.action, error);
  }
}
