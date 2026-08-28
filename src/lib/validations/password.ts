import { z } from "zod";

export const NEW_PASSWORD_MIN_LENGTH = 6;

export function getNewPasswordIssues(password: string): string[] {
	if (password.length < NEW_PASSWORD_MIN_LENGTH) {
		return [`Use at least ${NEW_PASSWORD_MIN_LENGTH} characters.`];
	}

	return [];
}

export const changePasswordSchema = z
	.object({
		newPassword: z.string(),
		confirmPassword: z.string().min(1, "Confirm your new password."),
	})
	.superRefine((values, ctx) => {
		for (const issue of getNewPasswordIssues(values.newPassword)) {
			ctx.addIssue({
				code: "custom",
				message: issue,
				path: ["newPassword"],
			});
		}

		if (values.newPassword !== values.confirmPassword) {
			ctx.addIssue({
				code: "custom",
				message: "Passwords do not match.",
				path: ["confirmPassword"],
			});
		}
	});

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const PASSWORD_REQUIREMENTS = [
	`At least ${NEW_PASSWORD_MIN_LENGTH} characters`,
] as const;
