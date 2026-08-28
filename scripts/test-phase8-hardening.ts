import {
  canAssignContact,
  canAssignContactToAssignee,
  canDistributeContacts,
} from "@/lib/auth/assignments";
import { canSendSmsBroadcasts, canManageWhatsAppTemplates } from "@/lib/auth/broadcasts";
import { canAccessCallQueue, canRecordCallAttempt } from "@/lib/auth/calls";
import { canChangeRole, canViewUser } from "@/lib/auth/permissions";
import { AUDIT_ACTIONS } from "@/lib/audit/types";
import { toClientErrorMessage } from "@/lib/errors/client-message";
import {
  getMissingProfileFields,
  isProfileComplete,
} from "@/lib/profile/completeness";
import { buildContactSearchFilter, escapeIlikePattern } from "@/lib/utils/search";
import { broadcastComposerSchema } from "@/lib/validations/broadcasts";
import type { Telepastor } from "@/types/domain";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTelepastor(
  overrides: Partial<Telepastor> & Pick<Telepastor, "id" | "role">,
): Telepastor {
  return {
    auth_user_id: null,
    name: overrides.name ?? "Test User",
    phone: "+233000000000",
    address: null,
    profile_picture_url: null,
    date_of_birth: null,
    occupation: null,
    is_active: true,
    leader_id: null,
    governor_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function testAuditActionCatalog() {
  assert(AUDIT_ACTIONS.TELEPASTOR_CREATED === "telepastor.created", "Audit catalog");
  assert(AUDIT_ACTIONS.SMS_BROADCAST_INITIATED === "sms.broadcast_initiated", "Broadcast audit");
  assert(AUDIT_ACTIONS.CONTACTS_IMPORTED === "contacts.imported", "Import audit");
}

function testErrorSanitization() {
  const sanitized = toClientErrorMessage(
    new Error("new row violates row-level security policy"),
    "Fallback message",
  );
  assert(sanitized === "Fallback message", "RLS errors are sanitized");

  const userFacing = toClientErrorMessage(
    new Error("Please select a campaign."),
    "Fallback message",
  );
  assert(userFacing === "Please select a campaign.", "User-facing errors pass through");

  const postgrestLike = toClientErrorMessage(
    { message: "duplicate key value violates unique constraint" },
    "Fallback message",
  );
  assert(postgrestLike === "Fallback message", "PostgREST-like objects are sanitized");
}

function testSearchEscaping() {
  assert(escapeIlikePattern("100%") === "100\\%", "Escapes percent");
  assert(escapeIlikePattern("a_b") === "a\\_b", "Escapes underscore");

  const filter = buildContactSearchFilter("John%");
  assert(Boolean(filter?.includes("John\\%")), "Search filter escapes input");
}

function testTelepastorIsolation() {
  const tpA = makeTelepastor({ id: "tp-a", role: "TELEPASTOR", leader_id: "lead-a" });
  const tpB = makeTelepastor({ id: "tp-b", role: "TELEPASTOR", leader_id: "lead-b" });
  const leaderA = makeTelepastor({
    id: "lead-a",
    role: "LEADER",
    governor_id: "gov-a",
  });

  assert(
    !canViewUser({ telepastor: tpA }, tpB, null),
    "Telepastor cannot view another telepastor",
  );
  assert(
    canViewUser({ telepastor: leaderA }, tpA),
    "Leader can view own telepastor",
  );
  assert(!canDistributeContacts({ telepastor: tpA }), "Telepastor cannot distribute");
  assert(!canSendSmsBroadcasts({ telepastor: tpA }), "Telepastor cannot broadcast");
}

function testRolePromotionBoundaries() {
  const superAdmin = makeTelepastor({ id: "sa", role: "SUPER_ADMIN" });
  const governor = makeTelepastor({ id: "gov", role: "GOVERNOR" });
  const leader = makeTelepastor({ id: "lead", role: "LEADER" });

  assert(canChangeRole({ telepastor: superAdmin }), "Only super admin changes roles");
  assert(!canChangeRole({ telepastor: governor }), "Governor cannot change roles");
  assert(!canChangeRole({ telepastor: leader }), "Leader cannot change roles");
}

function testAssignmentBoundaries() {
  const superAdmin = makeTelepastor({ id: "sa", role: "SUPER_ADMIN" });
  const governor = makeTelepastor({
    id: "gov-a",
    role: "GOVERNOR",
  });
  const leaderA = makeTelepastor({
    id: "lead-a",
    role: "LEADER",
    governor_id: "gov-a",
  });
  const leaderB = makeTelepastor({
    id: "lead-b",
    role: "LEADER",
    governor_id: "gov-b",
  });
  const tpA = makeTelepastor({
    id: "tp-a",
    role: "TELEPASTOR",
    leader_id: "lead-a",
    governor_id: "gov-a",
  });

  assert(
    canAssignContactToAssignee({ telepastor: superAdmin }, governor),
    "Super admin assigns to governor",
  );
  assert(
    canAssignContactToAssignee({ telepastor: governor }, leaderA),
    "Governor assigns to own leader",
  );
  assert(
    !canAssignContactToAssignee({ telepastor: governor }, leaderB),
    "Governor cannot assign to other org leader",
  );
  assert(
    canAssignContactToAssignee({ telepastor: leaderA }, tpA),
    "Leader assigns to own telepastor",
  );

  assert(
    canAssignContact(
      { telepastor: governor },
      {
        id: "c1",
        campaign_id: "camp-1",
        assignment_status: "ASSIGNED",
        current_assignee_id: "gov-a",
      },
    ),
    "Governor can reassign contacts assigned to self",
  );
  assert(
    !canAssignContact(
      { telepastor: leaderA },
      {
        id: "c1",
        campaign_id: "camp-1",
        assignment_status: "UNASSIGNED",
        current_assignee_id: null,
      },
    ),
    "Leader cannot assign unassigned contacts directly",
  );
}

function testCallRecordingAuthorization() {
  const tpA = makeTelepastor({ id: "tp-a", role: "TELEPASTOR", leader_id: "lead-a" });
  const contactForA = {
    id: "c1",
    campaign_id: "camp-1",
    current_assignee_id: "tp-a",
    latest_response: null,
    assignment_status: "ASSIGNED" as const,
    name: "John",
    phone: "+233000000001",
    phone_normalized: "+233000000001",
    campaign_name: "Test",
    attempt_count: 0,
  };
  const contactForB = { ...contactForA, current_assignee_id: "tp-b" };

  assert(canAccessCallQueue({ telepastor: tpA }), "Telepastor accesses call queue");
  assert(
    canAccessCallQueue({ telepastor: makeTelepastor({ id: "gov", role: "GOVERNOR" }) }),
    "Governor accesses call queue",
  );

  assert(
    canRecordCallAttempt({ telepastor: tpA }, contactForA),
    "Telepastor records own contact",
  );
  assert(
    !canRecordCallAttempt({ telepastor: tpA }, contactForB),
    "Telepastor cannot record other's contact",
  );
}

function testBroadcastRecipientValidation() {
  const result = broadcastComposerSchema.safeParse({
    message: "Hello {name}",
    scope: "TELEPASTOR_ASSIGNMENTS",
    telepastorId: "22222222-2222-4222-8222-222222222222",
  });
  assert(result.success, "Telepastor assignment scope validates");
}

function testTemplatePermissions() {
  const leader = makeTelepastor({ id: "lead", role: "LEADER" });
  const telepastor = makeTelepastor({ id: "tp", role: "TELEPASTOR" });

  assert(canManageWhatsAppTemplates({ telepastor: leader }), "Leader manages templates");
  assert(!canManageWhatsAppTemplates({ telepastor: telepastor }), "Telepastor cannot manage templates");
}

function testProfileCompleteness() {
  const incomplete = {
    address: null,
    date_of_birth: null,
    occupation: null,
    profile_picture_url: null,
  };

  assert(
    getMissingProfileFields(incomplete).length === 4,
    "All optional profile fields flagged when missing",
  );
  assert(!isProfileComplete(incomplete), "Incomplete profile detected");

  const complete = {
    address: "Accra",
    date_of_birth: "1990-01-01",
    occupation: "Teacher",
    profile_picture_url: "https://example.com/photo.jpg",
  };

  assert(isProfileComplete(complete), "Complete profile passes");
}

function main() {
  testAuditActionCatalog();
  testErrorSanitization();
  testSearchEscaping();
  testTelepastorIsolation();
  testRolePromotionBoundaries();
  testAssignmentBoundaries();
  testCallRecordingAuthorization();
  testBroadcastRecipientValidation();
  testTemplatePermissions();
  testProfileCompleteness();
  console.log("Phase 8 hardening tests passed.");
}

main();
