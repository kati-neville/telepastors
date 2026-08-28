import { z } from "zod";
import { parseLoginIdentifier } from "@/lib/auth/login-identifier";

export const loginSchema = z
	.object({
		identifier: z.string().trim().min(1, "Enter your email or phone number"),
		password: z.string().min(6, "Password must be at least 6 characters"),
	})
	.superRefine((data, ctx) => {
		const parsed = parseLoginIdentifier(data.identifier);

		if (parsed.type === "invalid") {
			ctx.addIssue({
				code: "custom",
				message: parsed.message,
				path: ["identifier"],
			});
		}
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
