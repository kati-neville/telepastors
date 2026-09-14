import { z } from "zod";

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export const createTelepastorSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    phone: z.string().trim().min(1, "Phone number is required"),
    address: z.string().trim().min(1, "Address is required"),
    role: z.enum(["GOVERNOR", "LEADER", "TELEPASTOR"]),
    leader_id: z.string().uuid().nullable().optional(),
    governor_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.role === "LEADER" && !values.governor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a Governor for this Leader",
        path: ["governor_id"],
      });
    }

    if (values.role === "TELEPASTOR" && !values.governor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a Governor for this Telepastor",
        path: ["governor_id"],
      });
    }
  });

export type CreateTelepastorValues = z.infer<typeof createTelepastorSchema>;

export const updateTelepastorProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  address: z.string().trim().optional(),
  date_of_birth: z.string().nullable().optional(),
  occupation: z.string().trim().nullable().optional(),
});

export type UpdateTelepastorProfileValues = z.infer<
  typeof updateTelepastorProfileSchema
>;

export const updateTelepastorRoleSchema = z
  .object({
    role: z.enum(["GOVERNOR", "LEADER", "TELEPASTOR"]),
    leader_id: z.string().uuid().nullable().optional(),
    governor_id: z.string().uuid().nullable().optional(),
    confirm: z.literal(true, { message: "Confirmation is required" }),
  })
  .superRefine((values, ctx) => {
    if (values.role === "LEADER" && !values.governor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A Governor is required for Leaders",
        path: ["governor_id"],
      });
    }

    if (values.role === "TELEPASTOR" && !values.governor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A Governor is required for Telepastors",
        path: ["governor_id"],
      });
    }
  });

export type UpdateTelepastorRoleValues = z.infer<typeof updateTelepastorRoleSchema>;

export const toggleActiveSchema = z.object({
  is_active: z.boolean(),
  confirm: z.literal(true, { message: "Confirmation is required" }),
});

export type ToggleActiveValues = z.infer<typeof toggleActiveSchema>;

export const telepastorsFilterSchema = z.object({
  q: z.string().optional(),
  role: z.enum(["ALL", "GOVERNOR", "LEADER", "TELEPASTOR"]).default("ALL"),
  governor: z.string().uuid().optional(),
  leader: z.string().uuid().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type TelepastorsFilterValues = z.infer<typeof telepastorsFilterSchema>;
