import type { Json } from "@/types/database";

export const MINISTRY_ROLES = [
  "SUPER_ADMIN",
  "GOVERNOR",
  "LEADER",
  "TELEPASTOR",
] as const;

export type MinistryRole = (typeof MINISTRY_ROLES)[number];

export type Telepastor = {
  id: string;
  auth_user_id: string | null;
  name: string;
  phone: string;
  phone_normalized: string | null;
  address: string | null;
  profile_picture_url: string | null;
  date_of_birth: string | null;
  occupation: string | null;
  role: MinistryRole;
  is_active: boolean;
  must_change_password: boolean;
  leader_id: string | null;
  governor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TelepastorSummary = Pick<
  Telepastor,
  "id" | "name" | "role" | "governor_id" | "leader_id"
> & {
  is_active?: boolean;
};

export type TelepastorDirectoryEntry = Telepastor & {
  leader_name: string | null;
  governor_name: string | null;
};

export type BirthdayEntry = TelepastorDirectoryEntry & {
  date_of_birth: string;
  birthdayMonth: number;
  birthdayDay: number;
  age: number;
  birthdayLabel: string;
};

export type BirthdayNotice = {
  viewerBirthdayToday: boolean;
  viewerName: string;
  todaysBirthdays: BirthdayEntry[];
};

export type TelepastorDetail = Telepastor & {
  leader: TelepastorSummary | null;
  governor: TelepastorSummary | null;
};

export type AuthSession = {
  userId: string;
  email: string | null;
  phone: string | null;
  loginIdentifier: string;
  telepastor: Telepastor;
};

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  status: CampaignStatus;
  call_script: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignDetail = Campaign & {
  created_by_name: string | null;
  contact_count: number;
  import_count: number;
  latest_import_at: string | null;
};

export type Contact = {
  id: string;
  campaign_id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  import_id: string | null;
  import_row_number: number | null;
  import_metadata: Json | null;
  latest_response: CallResponse | null;
  latest_notes: string | null;
  latest_response_at: string | null;
  latest_recorded_by: string | null;
  held_for_own_calls: boolean;
  assignment_status: ContactAssignmentStatus;
  current_assignee_id: string | null;
  current_assignment_id: string | null;
  created_at: string;
  updated_at: string;
};

export const CONTACT_ASSIGNMENT_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type ContactAssignmentStatus =
  (typeof CONTACT_ASSIGNMENT_STATUSES)[number];

export type ContactWithAssignee = Contact & {
  assignee_name: string | null;
  assignee_role: MinistryRole | null;
};

export type ContactAssignment = {
  id: string;
  contact_id: string;
  campaign_id: string;
  assignee_id: string;
  assigned_by: string | null;
  assignee_role: MinistryRole;
  status: ContactAssignmentStatus;
  assigned_at: string;
  ended_at: string | null;
  superseded_by: string | null;
  notes: string | null;
};

export type ContactAssignmentHistoryEntry = ContactAssignment & {
  assignee_name: string;
  assigned_by_name: string | null;
};

export type DistributionStats = {
  total: number;
  assigned: number;
  unassigned: number;
  assignedToMe: number;
};

export type ContactImportStatus = "PREVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";

export type ContactImport = {
  id: string;
  campaign_id: string;
  imported_by: string | null;
  file_name: string;
  status: ContactImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  column_mapping: Json | null;
  preview_data: Json | null;
  error_summary: Json | null;
  created_at: string;
  completed_at: string | null;
};

export type ContactImportSummary = ContactImport & {
  imported_by_name: string | null;
};

export type TelepastorImportStatus =
  | "PREVIEW"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TelepastorImportCredential = {
  id: string;
  name: string;
  phone: string;
  temporaryPassword: string;
  role: MinistryRole;
  rowNumber: number;
};

export type TelepastorImport = {
  id: string;
  imported_by: string | null;
  file_name: string;
  status: TelepastorImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  column_mapping: Json | null;
  preview_data: Json | null;
  error_summary: Json | null;
  credentials_export: Json | null;
  created_at: string;
  completed_at: string | null;
};

export const CALL_RESPONSES = [
  "COMING",
  "NOT_COMING",
  "UNREACHABLE",
  "WRONG_NUMBER",
  "OTHER",
] as const;

export type CallResponse = (typeof CALL_RESPONSES)[number];

export type CallAttempt = {
  id: string;
  contact_id: string;
  campaign_id: string;
  telepastor_id: string;
  assignment_id: string | null;
  response: CallResponse;
  notes: string | null;
  attempted_at: string;
};

export type CallAttemptWithContact = CallAttempt & {
  contact_name: string;
  contact_phone: string;
};

export type AssignedContact = Contact & {
  campaign_name: string;
  campaign_call_script: string | null;
  attempt_count: number;
};

export type CallQueueStats = {
  assigned: number;
  completed: number;
  remaining: number;
  coming: number;
  notComing: number;
  unreachable: number;
  wrongNumber: number;
  other: number;
};

export type CallQueueContact = AssignedContact & {
  prior_attempts: CallAttempt[];
};

export type CampaignStatistics = {
  totalContacts: number;
  assigned: number;
  unassigned: number;
  completed: number;
  remaining: number;
  totalCallAttempts: number;
  coming: number;
  notComing: number;
  unreachable: number;
  wrongNumber: number;
  other: number;
  completionPercentage: number;
  reachRate: number;
  comingPercentage: number;
};

export type TeamMemberStatistics = {
  memberId: string;
  memberName: string;
  memberRole: MinistryRole;
  stats: CampaignStatistics;
  totalCallAttempts: number;
  lastAttemptAt: string | null;
};

export type RecentCallActivity = {
  id: string;
  contactName: string;
  telepastorName: string;
  response: CallResponse;
  notes: string | null;
  attemptedAt: string;
  campaignName: string;
};

export type FollowUpContact = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  currentAssigneeId: string | null;
  campaignName: string;
  latestResponse: CallResponse | null;
  latestNotes: string;
  latestResponseAt: string | null;
  assigneeName: string;
  recordedByName: string;
};

export type TeamPerformanceBundle = {
  governorRows: TeamMemberStatistics[];
  memberRows: TeamMemberStatistics[];
  members: TelepastorSummary[];
};

export type LeadershipDashboardData = {
  scopeLabel: string;
  stats: CampaignStatistics;
  activeCampaigns: number;
  contactsWithNotesCount: number;
  teamPerformanceBundle: TeamPerformanceBundle;
  recentActivity: RecentCallActivity[];
  filterOptions: ReportFilterOptions;
};

export type ReportFilterOptions = {
  campaigns: { id: string; name: string }[];
  governors: TelepastorSummary[];
  leaders: TelepastorSummary[];
  telepastors: TelepastorSummary[];
};

export type TelepastorDashboardData = {
  stats: CallQueueStats;
  contactsWithNotesCount: number;
  recentActivity: RecentCallActivity[];
};

export const SMS_BROADCAST_STATUSES = [
  "PENDING",
  "SENDING",
  "COMPLETED",
  "FAILED",
  "UNAVAILABLE",
] as const;

export type SmsBroadcastStatus = (typeof SMS_BROADCAST_STATUSES)[number];

export const SMS_RECIPIENT_STATUSES = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "SKIPPED",
] as const;

export type SmsRecipientStatus = (typeof SMS_RECIPIENT_STATUSES)[number];

export const BROADCAST_RECIPIENT_SCOPES = [
  "ALL_CONTACTS",
  "GOVERNOR_ORG",
  "LEADER_ORG",
  "TELEPASTOR_ASSIGNMENTS",
  "CAMPAIGN",
  "SELECTED_CONTACTS",
  "RESPONSE_TYPE",
] as const;

export type BroadcastRecipientScope = (typeof BROADCAST_RECIPIENT_SCOPES)[number];

export type WhatsAppMessageTemplate = {
  id: string;
  name: string;
  slug: string;
  body: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SmsBroadcast = {
  id: string;
  message: string;
  campaign_id: string | null;
  recipient_scope: BroadcastRecipientScope;
  scope_config: Record<string, unknown>;
  recipient_count: number;
  estimated_sms_units: number | null;
  provider: string | null;
  status: SmsBroadcastStatus;
  delivered_count: number;
  failed_count: number;
  pending_count: number;
  created_by: string | null;
  confirmed_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type SmsBroadcastRecipient = {
  id: string;
  broadcast_id: string;
  contact_id: string | null;
  phone_normalized: string;
  contact_name: string | null;
  status: SmsRecipientStatus;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
};

export type SmsBroadcastSummary = SmsBroadcast & {
  created_by_name: string | null;
  campaign_name: string | null;
};

export type SmsBroadcastDetail = SmsBroadcastSummary & {
  scope_context_label: string | null;
  recipients: SmsBroadcastRecipient[];
};

export type BroadcastPreview = {
  recipientCount: number;
  estimatedSmsUnits: number;
  messagePreview: string;
  sampleRecipientName: string | null;
  providerConfigured: boolean;
  providerName: string | null;
};
