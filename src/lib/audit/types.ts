export const AUDIT_ACTIONS = {
  TELEPASTOR_CREATED: "telepastor.created",
  TELEPASTORS_IMPORTED: "telepastors.imported",
  TELEPASTOR_PROFILE_UPDATED: "telepastor.profile_updated",
  TELEPASTOR_ROLE_CHANGED: "telepastor.role_changed",
  TELEPASTOR_ACTIVATED: "telepastor.activated",
  TELEPASTOR_DEACTIVATED: "telepastor.deactivated",
  TELEPASTOR_DELETED: "telepastor.deleted",
  TELEPASTOR_PASSWORD_RESET: "telepastor.password_reset",
  TELEPASTOR_PHOTO_UPDATED: "telepastor.photo_updated",
  CAMPAIGN_CREATED: "campaign.created",
  CAMPAIGN_UPDATED: "campaign.updated",
  CAMPAIGN_CALL_SCRIPT_UPDATED: "campaign.call_script_updated",
  CONTACTS_IMPORTED: "contacts.imported",
  CONTACTS_CLEARED: "contacts.cleared",
  CONTACTS_ASSIGNED: "contacts.assigned",
  CONTACTS_REASSIGNED: "contacts.reassigned",
  CONTACTS_BULK_ASSIGNED: "contacts.bulk_assigned",
  CALL_RESPONSE_RECORDED: "call.response_recorded",
  SMS_BROADCAST_INITIATED: "sms.broadcast_initiated",
  WHATSAPP_TEMPLATE_SAVED: "whatsapp_template.saved",
  WHATSAPP_TEMPLATE_DEFAULT_CHANGED: "whatsapp_template.default_changed",
  PASSWORD_CHANGED: "auth.password_changed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  action: AuditAction | string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
