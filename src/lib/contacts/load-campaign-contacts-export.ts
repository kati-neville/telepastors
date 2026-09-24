import type { Contact } from "@/types/domain";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import type { CampaignContactExportRow } from "@/lib/excel/contact-export";

type PublicClient = SupabaseClient<Database, "public">;

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

	const assigneeIds = [
		...new Set(
			contacts
				.map(contact => contact.current_assignee_id)
				.filter((value): value is string => Boolean(value)),
		),
	];

	const { data: assignees } = assigneeIds.length
		? await supabase
				.from("telepastors")
				.select("id, name")
				.in("id", assigneeIds)
		: { data: [] };

	const assigneeMap = new Map(
		(assignees ?? []).map(assignee => [assignee.id, assignee.name]),
	);

	return contacts.map(contact => ({
		name: contact.name,
		phone: contact.phone,
		phoneNormalized: contact.phone_normalized,
		assignmentStatus: contact.assignment_status,
		assigneeName: contact.current_assignee_id
			? (assigneeMap.get(contact.current_assignee_id) ?? null)
			: null,
		latestResponse: contact.latest_response,
		latestNotes: contact.latest_notes,
		heldForOwnCalls: contact.held_for_own_calls,
		createdAt: contact.created_at,
	}));
}
