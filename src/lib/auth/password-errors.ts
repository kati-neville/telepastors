import { NEW_PASSWORD_MIN_LENGTH } from "@/lib/validations/password";

export function formatPasswordUpdateError(message: string): string {
	const normalized = message.toLowerCase();

	if (
		normalized.includes("at least 6 characters") ||
		normalized.includes("minimum 6")
	) {
		return `Passwords must be at least 6 characters on this Supabase project. Use 6 or more characters, or lower the minimum in Supabase Dashboard → Authentication → Sign In / Providers → Email.`;
	}

	if (normalized.includes("at least 6 characters")) {
		return `Use at least ${NEW_PASSWORD_MIN_LENGTH} characters.`;
	}

	return message;
}
