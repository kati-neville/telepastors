import type { Contact } from "@/types/domain";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import type { CampaignContactExportRow } from "@/lib/excel/contact-export";

type PublicClient = SupabaseClient<Database, "public">;

type AttemptAgg = {
	count: number;
	lastAttemptedAt: string;
};

/** Read-only: loads all contacts for a campaign export. Does not mutate data. */
export async function loadCampaignContactsForExport(
	supabase: PublicClient,
	campaignId: string,
): Promise<CampaignContactExportRow[]> {
	const contacts = await fetchAllPages<Contact>(async (from, to) =>
		supabase
			.from("contacts")
			.select("*")
			.eq("campaign_id", campaignId)
			.order("name", { ascending: true })
			.range(from, to),
	);

	const attempts = await fetchAllPages<{
		contact_id: string;
		attempted_at: string;
	}>(async (from, to) =>
		supabase
			.from("call_attempts")
			.select("contact_id, attempted_at")
			.eq("campaign_id", campaignId)
			.order("contact_id", { ascending: true })
			.range(from, to),
	);

	const attemptMap = new Map<string, AttemptAgg>();
	for (const attempt of attempts) {
		const current = attemptMap.get(attempt.contact_id);
		if (!current) {
			attemptMap.set(attempt.contact_id, {
				count: 1,
				lastAttemptedAt: attempt.attempted_at,
			});
			continue;
		}

		current.count += 1;
		if (attempt.attempted_at > current.lastAttemptedAt) {
			current.lastAttemptedAt = attempt.attempted_at;
		}
	}

	const personIds = [
		...new Set(
			[
				...contacts.map(contact => contact.current_assignee_id),
				...contacts.map(contact => contact.latest_recorded_by),
			].filter((value): value is string => Boolean(value)),
		),
	];

	const personMap = new Map<string, string>();
	for (let index = 0; index < personIds.length; index += 200) {
		const batch = personIds.slice(index, index + 200);
		const { data: people } = await supabase
			.from("telepastors")
			.select("id, name")
			.in("id", batch);
		for (const person of people ?? []) {
			personMap.set(person.id, person.name);
		}
	}

	return contacts.map(contact => {
		const attempt = attemptMap.get(contact.id);
		return {
			name: contact.name,
			phone: contact.phone,
			phoneNormalized: contact.phone_normalized,
			assignmentStatus: contact.assignment_status,
			assigneeName: contact.current_assignee_id
				? (personMap.get(contact.current_assignee_id) ?? null)
				: null,
			latestResponse: contact.latest_response,
			latestNotes: contact.latest_notes,
			latestResponseAt: contact.latest_response_at,
			recordedByName: contact.latest_recorded_by
				? (personMap.get(contact.latest_recorded_by) ?? null)
				: null,
			attemptCount: attempt?.count ?? 0,
			lastAttemptedAt: attempt?.lastAttemptedAt ?? null,
			heldForOwnCalls: contact.held_for_own_calls,
			createdAt: contact.created_at,
		};
	});
}
