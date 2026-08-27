import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const telepastorProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
  profile_picture_url: z.string().url().optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  occupation: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "GOVERNOR", "LEADER", "TELEPASTOR"]),
  is_active: z.boolean(),
  leader_id: z.string().uuid().nullable().optional(),
  governor_id: z.string().uuid().nullable().optional(),
});

export type TelepastorProfileValues = z.infer<typeof telepastorProfileSchema>;
