import { getDistributionPoolFilter } from "@/lib/auth/assignments";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import {
	countDistributionPoolContactsForCampaign,
	fetchDistributionPoolContactsForCampaign,
} from "@/lib/assignments/fetch-distribution-pool";
import { formatSupabaseError } from "@/lib/supabase/errors";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createClient } from "@/lib/supabase/server";
import { buildContactSearchFilter } from "@/lib/utils/search";
import type {
	Contact,
	ContactAssignmentHistoryEntry,
	ContactWithAssignee,
	DistributionStats,
	MinistryRole,
	TelepastorSummary,
} from "@/types/domain";
import type { DistributionFilterValues } from "@/lib/validations/assignments";

export type CampaignAssignmentCounts = {
	total: number;
	assigned: number;
	unassigned: number;
};

/** Lean counts for campaign details — no distribution pool materialization. */
export async function fetchCampaignAssignmentCounts(
	campaignId: string,
): Promise<CampaignAssignmentCounts> {
	const supabase = await createClient();

	const [
		{ count: total, error: totalError },
		{ count: assigned, error: assignedError },
		{ count: unassigned, error: unassignedError },
	] = await Promise.all([
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId),
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId)
			.neq("assignment_status", "UNASSIGNED"),
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId)
			.eq("assignment_status", "UNASSIGNED"),
	]);

	if (totalError || assignedError || unassignedError) {
		throw new Error(
			formatSupabaseError(
				totalError ?? assignedError ?? unassignedError,
				"Failed to load assignment counts.",
			),
		);
	}

	return {
		total: total ?? 0,
		assigned: assigned ?? 0,
		unassigned: unassigned ?? 0,
	};
}

export async function fetchDistributionStats(
	campaignId: string,
	context: AuthorizationContext,
): Promise<DistributionStats> {
	const supabase = await createClient();
	const pool = getDistributionPoolFilter(context);

	// Governors/leaders only need their own pool counts. Campaign-wide HEAD counts
	// (total/assigned/unassigned) scan the whole campaign under RLS and time out
	// on large campaigns (~15k+) with empty PostgREST errors.
	if (pool === "assigned_to_self") {
		const actorId = context.telepastor.id;

		const [assignedToMe, heldResult, assignedToActorResult] = await Promise.all(
			[
				countDistributionPoolContactsForCampaign(campaignId, context),
				supabase
					.from("contacts")
					.select("id", { count: "exact", head: true })
					.eq("campaign_id", campaignId)
					.eq("current_assignee_id", actorId)
					.eq("held_for_own_calls", true),
				supabase
					.from("contacts")
					.select("id", { count: "exact", head: true })
					.eq("campaign_id", campaignId)
					.eq("current_assignee_id", actorId),
			],
		);

		if (heldResult.error) {
			throw new Error(
				formatSupabaseError(
					heldResult.error,
					"Failed to load held-for-calls count.",
				),
			);
		}

		if (assignedToActorResult.error) {
			throw new Error(
				formatSupabaseError(
					assignedToActorResult.error,
					"Failed to load assignment stats.",
				),
			);
		}

		const assignedToActor = assignedToActorResult.count ?? 0;

		return {
			total: assignedToActor,
			assigned: assignedToActor,
			unassigned: 0,
			assignedToMe,
			heldForOwnCalls: heldResult.count ?? 0,
		};
	}

	const [
		{ count: total, error: totalError },
		{ count: assigned, error: assignedError },
		{ count: unassigned, error: unassignedError },
		assignedToMe,
	] = await Promise.all([
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId),
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId)
			.neq("assignment_status", "UNASSIGNED"),
		supabase
			.from("contacts")
			.select("id", { count: "exact", head: true })
			.eq("campaign_id", campaignId)
			.eq("assignment_status", "UNASSIGNED"),
		countDistributionPoolContactsForCampaign(campaignId, context),
	]);

	if (totalError || assignedError || unassignedError) {
		throw new Error(
			formatSupabaseError(
				totalError ?? assignedError ?? unassignedError,
				"Failed to load assignment stats.",
			),
		);
	}

	return {
		total: total ?? 0,
		assigned: assigned ?? 0,
		unassigned: unassigned ?? 0,
		assignedToMe,
		heldForOwnCalls: 0,
	};
}

export async function fetchDistributionContacts(
	campaignId: string,
	context: AuthorizationContext,
	filters: DistributionFilterValues,
): Promise<ContactWithAssignee[]> {
	const supabase = await createClient();
	const pool = getDistributionPoolFilter(context);

	const search = filters.q?.trim();

	const contacts = await fetchAllPages<Contact>(async (from, to) => {
		let query = supabase
			.from("contacts")
			.select("*")
			.eq("campaign_id", campaignId)
			.order("name", { ascending: true })
			.range(from, to);

		if (pool === "unassigned") {
			if (filters.pool === "unassigned" || filters.pool === "all") {
				if (filters.pool === "unassigned") {
					query = query.eq("assignment_status", "UNASSIGNED");
				}
			} else if (filters.pool === "assigned") {
				query = query.neq("assignment_status", "UNASSIGNED");
			}
		}

		if (search) {
			const filter = buildContactSearchFilter(search);
			if (filter) {
				query = query.or(filter);
			}
		}

		return query;
	});

	let visibleContacts = contacts;

	if (pool === "assigned_to_self") {
		const poolContacts = await fetchDistributionPoolContactsForCampaign(
			campaignId,
			context,
		);
		const poolIds = new Set(poolContacts.map(contact => contact.id));
		visibleContacts = contacts.filter(contact => poolIds.has(contact.id));
	}

	const assigneeIds = [
		...new Set(
			visibleContacts
				.map(c => c.current_assignee_id)
				.filter((value): value is string => Boolean(value)),
		),
	];

	const { data: assignees } = assigneeIds.length
		? await supabase
				.from("telepastors")
				.select("id, name, role")
				.in("id", assigneeIds)
		: { data: [] };

	const assigneeMap = new Map(
		(assignees ?? []).map(a => [a.id, { name: a.name, role: a.role }]),
	);

	return visibleContacts.map(contact => {
		const assignee = contact.current_assignee_id
			? assigneeMap.get(contact.current_assignee_id)
			: null;

		return {
			...contact,
			assignee_name: assignee?.name ?? null,
			assignee_role: (assignee?.role as MinistryRole | undefined) ?? null,
		};
	});
}

export async function fetchAssignableMembers(
	context: AuthorizationContext,
): Promise<TelepastorSummary[]> {
	const supabase = await createClient();

	let query = supabase
		.from("telepastors")
		.select("id, name, role, governor_id, leader_id")
		.eq("is_active", true)
		.order("name");

	if (context.telepastor.role === "SUPER_ADMIN") {
		query = query.eq("role", "GOVERNOR");
	} else if (context.telepastor.role === "GOVERNOR") {
		query = query
			.eq("governor_id", context.telepastor.id)
			.or("role.eq.LEADER,and(role.eq.TELEPASTOR,leader_id.is.null)");
	} else if (context.telepastor.role === "LEADER") {
		query = query
			.eq("role", "TELEPASTOR")
			.eq("leader_id", context.telepastor.id);
	} else {
		return [];
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(error.message);
	}

	return data ?? [];
}

export async function fetchContactAssignmentHistory(
	contactId: string,
): Promise<ContactAssignmentHistoryEntry[]> {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("contact_assignments")
		.select("*")
		.eq("contact_id", contactId)
		.order("assigned_at", { ascending: false });

	if (error) {
		throw new Error(error.message);
	}

	const assignments = data ?? [];
	const telepastorIds = [
		...new Set(
			assignments
				.flatMap(a => [a.assignee_id, a.assigned_by])
				.filter((value): value is string => Boolean(value)),
		),
	];

	const { data: telepastors } = telepastorIds.length
		? await supabase
				.from("telepastors")
				.select("id, name")
				.in("id", telepastorIds)
		: { data: [] };

	const nameMap = new Map((telepastors ?? []).map(tp => [tp.id, tp.name]));

	return assignments.map(assignment => ({
		...assignment,
		assignee_name: nameMap.get(assignment.assignee_id) ?? "Unknown",
		assigned_by_name: assignment.assigned_by
			? (nameMap.get(assignment.assigned_by) ?? null)
			: null,
	}));
}

export async function fetchDistributionPoolContactIds(
	campaignId: string,
	context: AuthorizationContext,
): Promise<string[]> {
	const contacts = await fetchDistributionPoolContactsForCampaign(
		campaignId,
		context,
	);

	return contacts.map(contact => contact.id);
}

export async function fetchHeldForOwnCallContactIds(
	campaignId: string,
	actorId: string,
): Promise<string[]> {
	const supabase = await createClient();

	const contacts = await fetchAllPages<{ id: string }>(async (from, to) =>
		supabase
			.from("contacts")
			.select("id")
			.eq("campaign_id", campaignId)
			.eq("current_assignee_id", actorId)
			.eq("held_for_own_calls", true)
			.order("name", { ascending: true })
			.range(from, to),
	);

	return contacts.map(contact => contact.id);
}

export async function fetchContactsByIds(contactIds: string[]) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("contacts")
		.select("*")
		.in("id", contactIds);

	if (error) {
		throw new Error(error.message);
	}

	return data ?? [];
}

export async function fetchAssigneeById(assigneeId: string) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("telepastors")
		.select("id, name, role, governor_id, leader_id, is_active")
		.eq("id", assigneeId)
		.maybeSingle();

	if (error) {
		throw new Error(error.message);
	}

	return data;
}

export async function fetchCampaignsForDistribution(
	context: AuthorizationContext,
) {
	const supabase = await createClient();

	if (
		context.telepastor.role === "SUPER_ADMIN" ||
		context.telepastor.role === "GOVERNOR"
	) {
		const { data, error } = await supabase
			.from("campaigns")
			.select("*")
			.order("created_at", { ascending: false });

		if (error) throw new Error(error.message);
		return data ?? [];
	}

	const { data: contacts, error: contactsError } = await supabase
		.from("contacts")
		.select("campaign_id")
		.eq("current_assignee_id", context.telepastor.id);

	if (contactsError) throw new Error(contactsError.message);

	const campaignIds = [...new Set((contacts ?? []).map(c => c.campaign_id))];
	if (campaignIds.length === 0) return [];

	const { data, error } = await supabase
		.from("campaigns")
		.select("*")
		.in("id", campaignIds)
		.order("created_at", { ascending: false });

	if (error) throw new Error(error.message);
	return data ?? [];
}

export type DistributionCampaignSummary = {
	id: string;
	name: string;
	readyCount: number;
};

export async function fetchDistributionSummary(
	context: AuthorizationContext,
): Promise<{
	totalReady: number;
	campaigns: DistributionCampaignSummary[];
}> {
	const campaigns = await fetchCampaignsForDistribution(context);

	if (campaigns.length === 0) {
		return { totalReady: 0, campaigns: [] };
	}

	const CONCURRENCY = 3;
	const summaries: DistributionCampaignSummary[] = [];

	for (let index = 0; index < campaigns.length; index += CONCURRENCY) {
		const batch = campaigns.slice(index, index + CONCURRENCY);
		const batchResults = await Promise.all(
			batch.map(async campaign => {
				try {
					const readyCount = await countDistributionPoolContactsForCampaign(
						campaign.id,
						context,
					);
					return {
						id: campaign.id,
						name: campaign.name,
						readyCount,
					};
				} catch {
					return {
						id: campaign.id,
						name: campaign.name,
						readyCount: 0,
					};
				}
			}),
		);
		summaries.push(...batchResults);
	}

	return {
		totalReady: summaries.reduce(
			(sum, campaign) => sum + campaign.readyCount,
			0,
		),
		campaigns: summaries,
	};
}

export async function fetchRecentDistributionJobsForActor(
	campaignId: string,
	actorId: string,
	limit = 10,
) {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("distribution_jobs")
		.select(
			"id, campaign_id, status, retain_count, pool_total, assigned_count, completed_at, undone_at, result, undo_result, plan, created_at",
		)
		.eq("campaign_id", campaignId)
		.eq("actor_id", actorId)
		.in("status", ["completed", "undone"])
		.order("completed_at", { ascending: false, nullsFirst: false })
		.limit(limit);

	if (error) {
		// Older DBs may not have undone_at/undo_result yet.
		if (
			error.message?.includes("undone_at") ||
			error.message?.includes("undo_result") ||
			error.code === "42703"
		) {
			const fallback = await supabase
				.from("distribution_jobs")
				.select(
					"id, campaign_id, status, retain_count, pool_total, assigned_count, completed_at, result, plan, created_at",
				)
				.eq("campaign_id", campaignId)
				.eq("actor_id", actorId)
				.eq("status", "completed")
				.order("completed_at", { ascending: false, nullsFirst: false })
				.limit(limit);

			if (fallback.error) {
				throw new Error(fallback.error.message);
			}

			const { mapDistributionJobRow } =
				await import("@/lib/assignments/undo-distribution");
			return (fallback.data ?? []).map(mapDistributionJobRow);
		}

		throw new Error(error.message);
	}

	const { mapDistributionJobRow } =
		await import("@/lib/assignments/undo-distribution");
	return (data ?? []).map(mapDistributionJobRow);
}
