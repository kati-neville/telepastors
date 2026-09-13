import { normalizePhone } from "@/lib/phone/normalize";
import {
  getAssignableRolesForCreate,
  resolveHierarchyFields,
  validateCreatePlacement,
  validateHierarchy,
  type HierarchyLookup,
} from "@/lib/auth/hierarchy";
import type { TelepastorImportColumnMapping } from "@/lib/excel/telepastor-column-mapping";
import type { MinistryRole, Telepastor } from "@/types/domain";

export type TelepastorImportRowStatus = "valid" | "invalid" | "duplicate";

export type ValidatedTelepastorImportRow = {
  rowNumber: number;
  name: string;
  phone: string;
  phoneNormalized: string | null;
  address: string;
  role: MinistryRole | null;
  leaderPhone: string;
  governorPhone: string;
  leaderId: string | null;
  governorId: string | null;
  status: TelepastorImportRowStatus;
  errors: string[];
  duplicateReason: "file" | "directory" | null;
};

export type TelepastorImportLookupMaps = {
  byPhone: Map<
    string,
    HierarchyLookup & {
      phone_normalized: string | null;
      name: string;
    }
  >;
};

export type TelepastorImportValidationSummary = {
  totalRows: number;
  validRows: ValidatedTelepastorImportRow[];
  invalidRows: ValidatedTelepastorImportRow[];
  duplicateRows: ValidatedTelepastorImportRow[];
  missingNameRows: number;
  missingPhoneRows: number;
  missingAddressRows: number;
  rows: ValidatedTelepastorImportRow[];
};

const ALLOWED_IMPORT_ROLES: MinistryRole[] = [
  "GOVERNOR",
  "LEADER",
  "TELEPASTOR",
];

function parseRole(raw: string): MinistryRole | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (ALLOWED_IMPORT_ROLES.includes(normalized as MinistryRole)) {
    return normalized as MinistryRole;
  }
  return null;
}

export function validateTelepastorImportRows(
  rows: Record<string, string>[],
  mapping: TelepastorImportColumnMapping,
  existingNormalizedPhones: Set<string>,
  lookups: TelepastorImportLookupMaps,
  actor: Pick<Telepastor, "id" | "role">,
): TelepastorImportValidationSummary {
  const seenInFile = new Set<string>();
  const validated: ValidatedTelepastorImportRow[] = [];
  const assignableRoles = getAssignableRolesForCreate(actor.role);

  let missingNameRows = 0;
  let missingPhoneRows = 0;
  let missingAddressRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = row[mapping.nameColumn]?.trim() ?? "";
    const phone = row[mapping.phoneColumn]?.trim() ?? "";
    const address = row[mapping.addressColumn]?.trim() ?? "";
    const roleRaw = row[mapping.roleColumn]?.trim() ?? "";
    const leaderPhone = row[mapping.leaderPhoneColumn]?.trim() ?? "";
    const governorPhone = row[mapping.governorPhoneColumn]?.trim() ?? "";
    const errors: string[] = [];

    if (!name) {
      missingNameRows += 1;
      errors.push("Missing name");
    }

    if (!phone) {
      missingPhoneRows += 1;
      errors.push("Missing phone number");
    }

    if (!address) {
      missingAddressRows += 1;
      errors.push("Missing address");
    }

    const role = roleRaw ? parseRole(roleRaw) : null;
    if (!roleRaw) {
      errors.push("Missing role");
    } else if (!role) {
      errors.push("Role must be GOVERNOR, LEADER, or TELEPASTOR");
    } else if (!assignableRoles.includes(role)) {
      errors.push(`You cannot import members with role ${role}`);
    }

    let phoneNormalized: string | null = null;
    if (phone) {
      const normalized = normalizePhone(phone);
      if (!normalized.ok) {
        errors.push(normalized.error);
      } else {
        phoneNormalized = normalized.normalized;
      }
    }

    let leaderId: string | null = null;
    let governorId: string | null = null;
    let leader: HierarchyLookup | null = null;
    let governor: HierarchyLookup | null = null;

    if (role === "TELEPASTOR") {
      if (actor.role === "LEADER") {
        leaderId = actor.id;
        leader = {
          id: actor.id,
          role: "LEADER",
          governor_id: null,
          leader_id: null,
        };
      } else if (!leaderPhone) {
        errors.push("Leader Phone is required for TELEPASTOR rows");
      } else {
        const leaderNormalized = normalizePhone(leaderPhone);
        if (!leaderNormalized.ok) {
          errors.push(`Leader phone: ${leaderNormalized.error}`);
        } else {
          const match = lookups.byPhone.get(leaderNormalized.normalized);
          if (!match || match.role !== "LEADER") {
            errors.push("Leader Phone does not match an existing Leader");
          } else {
            leaderId = match.id;
            leader = match;
          }
        }
      }
    }

    if (role === "LEADER") {
      if (actor.role === "GOVERNOR") {
        governorId = actor.id;
        governor = {
          id: actor.id,
          role: "GOVERNOR",
          governor_id: null,
          leader_id: null,
        };
      } else if (!governorPhone) {
        errors.push("Governor Phone is required for LEADER rows");
      } else {
        const governorNormalized = normalizePhone(governorPhone);
        if (!governorNormalized.ok) {
          errors.push(`Governor phone: ${governorNormalized.error}`);
        } else {
          const match = lookups.byPhone.get(governorNormalized.normalized);
          if (!match || match.role !== "GOVERNOR") {
            errors.push("Governor Phone does not match an existing Governor");
          } else {
            governorId = match.id;
            governor = match;
          }
        }
      }
    }

    if (role && errors.length === 0) {
      const hierarchyError = validateHierarchy({
        role,
        leader_id: leaderId,
        governor_id: governorId,
      });
      if (hierarchyError) {
        errors.push(hierarchyError);
      } else {
        const placementError = validateCreatePlacement(
          actor,
          { role, leader_id: leaderId, governor_id: governorId },
          leader,
          governor,
        );
        if (placementError) {
          errors.push(placementError);
        } else {
          const resolved = resolveHierarchyFields({
            role,
            leader_id: leaderId,
            governor_id: governorId,
          });
          leaderId = resolved.leader_id;
          governorId = resolved.governor_id;
        }
      }
    }

    let status: TelepastorImportRowStatus = "valid";
    let duplicateReason: "file" | "directory" | null = null;

    if (errors.length > 0) {
      status = "invalid";
    } else if (phoneNormalized) {
      if (seenInFile.has(phoneNormalized)) {
        status = "duplicate";
        duplicateReason = "file";
        errors.push("Duplicate phone number within this file");
      } else if (existingNormalizedPhones.has(phoneNormalized)) {
        status = "duplicate";
        duplicateReason = "directory";
        errors.push("Phone number already exists in the directory");
      } else {
        seenInFile.add(phoneNormalized);
      }
    }

    validated.push({
      rowNumber,
      name,
      phone,
      phoneNormalized,
      address,
      role,
      leaderPhone,
      governorPhone,
      leaderId,
      governorId,
      status,
      errors,
      duplicateReason,
    });
  });

  return {
    totalRows: rows.length,
    validRows: validated.filter((row) => row.status === "valid"),
    invalidRows: validated.filter((row) => row.status === "invalid"),
    duplicateRows: validated.filter((row) => row.status === "duplicate"),
    missingNameRows,
    missingPhoneRows,
    missingAddressRows,
    rows: validated,
  };
}

export const TELEPASTOR_IMPORT_COMMIT_BATCH_SIZE = 25;
