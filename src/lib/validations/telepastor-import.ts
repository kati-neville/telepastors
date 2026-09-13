import { z } from "zod";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/campaigns";

export {
  ACCEPTED_IMPORT_EXTENSIONS,
  ACCEPTED_IMPORT_TYPES,
  MAX_IMPORT_FILE_BYTES,
};

export const telepastorImportColumnMappingSchema = z.object({
  nameColumn: z.string().min(1, "Select a name column"),
  phoneColumn: z.string().min(1, "Select a phone column"),
  addressColumn: z.string().min(1, "Select an address column"),
  roleColumn: z.string().min(1, "Select a role column"),
  leaderPhoneColumn: z.string().min(1, "Select a leader phone column"),
  governorPhoneColumn: z.string().min(1, "Select a governor phone column"),
});

export type TelepastorImportColumnMappingValues = z.infer<
  typeof telepastorImportColumnMappingSchema
>;
