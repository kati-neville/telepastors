import {
	canAssignContact,
	canAssignContactToAssignee,
	canDistributeContacts,
	getDistributionPoolFilter,
	getTargetAssigneeRole,
} from "@/lib/auth/assignments";
import {
	computeEqualSplit,
	getDefaultRetainCount,
	partitionContacts,
	splitPoolForRetention,
	validateDistributionTotals,
	validateSplitTotals,
} from "@/lib/assignments/distribute-equally";
import { aggregateAssigneeUndoRows } from "@/lib/assignments/assignee-undo";
import {
	isContactCalledForCurrentWork,
	partitionCalledStatusRows,
	summarizeUndoAssigneePreview,
} from "@/lib/assignments/called-contacts";
import {
	isContactReadyForDownstreamDistribution,
	isRetainedForCallingAssignment,
	RETAINED_FOR_CALLING_NOTE,
} from "@/lib/assignments/distribution-pool";
import { canRetainContactsForCalling } from "@/lib/auth/assignments";
import type { Telepastor } from "@/types/domain";

function assert(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(message);
	}
}

function makeTelepastor(
	overrides: Partial<Telepastor> & Pick<Telepastor, "id" | "role">,
): Telepastor {
	return {
		auth_user_id: null,
		organization_id: overrides.organization_id ?? "org-1",
		name: overrides.name ?? "Test User",
		phone: "+233000000000",
		phone_normalized: null,
		address: null,
		profile_picture_url: null,
		date_of_birth: null,
		occupation: null,
		is_active: true,
		must_change_password: false,
		leader_id: null,
		governor_id: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...overrides,
	};
}

function contextFor(telepastor: Telepastor) {
	return { telepastor };
}

function testDistributionPermissions() {
	const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
	const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
	makeTelepastor({ id: "gov-b", role: "GOVERNOR" });
	const leaderA = makeTelepastor({
		id: "lead-a",
		role: "LEADER",
		governor_id: "gov-a",
	});
	const leaderB = makeTelepastor({
		id: "lead-b",
		role: "LEADER",
		governor_id: "gov-b",
	});
	const telepastorA = makeTelepastor({
		id: "tp-a",
		role: "TELEPASTOR",
		leader_id: "lead-a",
		governor_id: "gov-a",
	});
	const telepastorB = makeTelepastor({
		id: "tp-b",
		role: "TELEPASTOR",
		leader_id: "lead-b",
		governor_id: "gov-b",
	});

	assert(
		canDistributeContacts(contextFor(superAdmin)),
		"Super admin can distribute",
	);
	assert(
		canDistributeContacts(contextFor(governorA)),
		"Governor can distribute",
	);
	assert(canDistributeContacts(contextFor(leaderA)), "Leader can distribute");
	assert(
		!canDistributeContacts(contextFor(telepastorA)),
		"Telepastor cannot distribute",
	);

	assert(
		getTargetAssigneeRole("SUPER_ADMIN") === "GOVERNOR",
		"Super admin targets governors",
	);
	assert(
		getTargetAssigneeRole("GOVERNOR") === "LEADER",
		"Governor targets leaders",
	);
	assert(
		getTargetAssigneeRole("LEADER") === "TELEPASTOR",
		"Leader targets telepastors",
	);
	assert(
		getTargetAssigneeRole("TELEPASTOR") === null,
		"Telepastor has no target",
	);

	assert(
		canAssignContactToAssignee(contextFor(superAdmin), governorA),
		"Super admin -> Governor A",
	);
	assert(
		!canAssignContactToAssignee(contextFor(superAdmin), leaderA),
		"Super admin cannot assign to leader",
	);

	assert(
		canAssignContactToAssignee(contextFor(governorA), leaderA),
		"Governor A -> Leader A",
	);
	assert(
		!canAssignContactToAssignee(contextFor(governorA), leaderB),
		"Governor A cannot -> Leader B",
	);
	assert(
		!canAssignContactToAssignee(contextFor(governorA), telepastorA),
		"Governor A cannot -> led Telepastor (must go via Leader)",
	);

	const leaderlessTp = makeTelepastor({
		id: "tp-direct",
		role: "TELEPASTOR",
		leader_id: null,
		governor_id: "gov-a",
	});
	assert(
		canAssignContactToAssignee(contextFor(governorA), leaderlessTp),
		"Governor A -> leaderless Telepastor in org",
	);
	assert(
		!canAssignContactToAssignee(contextFor(leaderA), leaderlessTp),
		"Leader A cannot -> leaderless Telepastor",
	);

	assert(
		canAssignContactToAssignee(contextFor(leaderA), telepastorA),
		"Leader A -> Telepastor A",
	);
	assert(
		!canAssignContactToAssignee(contextFor(leaderA), telepastorB),
		"Leader A cannot -> Telepastor B",
	);
	assert(
		!canAssignContactToAssignee(contextFor(leaderA), governorA),
		"Leader A cannot -> Governor",
	);

	assert(
		!canAssignContactToAssignee(contextFor(telepastorA), telepastorB),
		"Telepastor cannot assign",
	);
}

function testContactPoolPermissions() {
	const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
	const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
	const leaderA = makeTelepastor({
		id: "lead-a",
		role: "LEADER",
		governor_id: "gov-a",
	});

	assert(
		getDistributionPoolFilter(contextFor(superAdmin)) === "unassigned",
		"Super admin pool is unassigned",
	);
	assert(
		getDistributionPoolFilter(contextFor(governorA)) === "assigned_to_self",
		"Governor pool is assigned_to_self",
	);
	assert(
		getDistributionPoolFilter(contextFor(leaderA)) === "assigned_to_self",
		"Leader pool is assigned_to_self",
	);

	const unassignedContact = {
		id: "c-1",
		campaign_id: "camp-1",
		assignment_status: "UNASSIGNED",
		current_assignee_id: null,
	};

	const assignedToGovernor = {
		id: "c-2",
		campaign_id: "camp-1",
		assignment_status: "ASSIGNED",
		current_assignee_id: "gov-a",
	};

	const assignedToLeader = {
		id: "c-3",
		campaign_id: "camp-1",
		assignment_status: "ASSIGNED",
		current_assignee_id: "lead-a",
	};

	assert(
		canAssignContact(contextFor(superAdmin), unassignedContact),
		"Super admin can assign unassigned contact",
	);
	assert(
		canAssignContact(contextFor(superAdmin), assignedToGovernor),
		"Super admin can reassign any contact",
	);

	assert(
		!canAssignContact(contextFor(governorA), unassignedContact),
		"Governor cannot assign unassigned contact",
	);
	assert(
		canAssignContact(contextFor(governorA), assignedToGovernor),
		"Governor can assign contacts assigned to self",
	);
	assert(
		!canAssignContact(contextFor(governorA), assignedToLeader),
		"Governor cannot assign contacts assigned to leader",
	);

	assert(
		canAssignContact(contextFor(leaderA), assignedToLeader),
		"Leader can assign contacts assigned to self",
	);
	assert(
		!canAssignContact(contextFor(leaderA), assignedToGovernor),
		"Leader cannot assign contacts assigned to governor",
	);
}

type AssignmentRecord = {
	id: string;
	contact_id: string;
	assignee_id: string;
	assigned_by: string;
	ended_at: string | null;
	superseded_by: string | null;
};

function testAssignmentHistoryModel() {
	const history: AssignmentRecord[] = [];

	function assign(
		contactId: string,
		assigneeId: string,
		assignedBy: string,
	): string {
		const active = history.find(
			entry => entry.contact_id === contactId && entry.ended_at === null,
		);

		const newId = `asgn-${history.length + 1}`;
		const now = new Date().toISOString();

		if (active) {
			active.ended_at = now;
			active.superseded_by = newId;
		}

		history.push({
			id: newId,
			contact_id: contactId,
			assignee_id: assigneeId,
			assigned_by: assignedBy,
			ended_at: null,
			superseded_by: null,
		});

		return newId;
	}

	assign("contact-1", "gov-a", "super-admin");
	assign("contact-1", "lead-a", "gov-a");
	assign("contact-1", "tp-a", "lead-a");

	assert(history.length === 3, "Three assignment records preserved");

	const active = history.find(
		entry => entry.contact_id === "contact-1" && entry.ended_at === null,
	);
	assert(active?.assignee_id === "tp-a", "Current assignee is telepastor");

	const first = history[0]!;
	assert(first.ended_at !== null, "First assignment ended");
	assert(first.superseded_by === history[1]!.id, "First assignment superseded");

	const second = history[1]!;
	assert(
		second.superseded_by === history[2]!.id,
		"Second assignment superseded",
	);
}

function testBulkAssignmentCounts() {
	const totalContacts = 1000;
	const assigneeIds = ["gov-a", "gov-b", "gov-c", "gov-d"];
	const split = computeEqualSplit(totalContacts, assigneeIds);

	assert(split.get("gov-a") === 250, "Even split for gov-a");
	assert(split.get("gov-b") === 250, "Even split for gov-b");
	assert(validateSplitTotals(totalContacts, split), "Split totals match");
}

function testEqualSplitRemainder() {
	const assigneeIds = ["lead-a", "lead-b", "lead-c", "lead-d", "lead-e"];
	const split = computeEqualSplit(1003, assigneeIds);

	assert(
		split.get("lead-a") === 201,
		"First assignee gets extra from remainder",
	);
	assert(
		split.get("lead-b") === 201,
		"Second assignee gets extra from remainder",
	);
	assert(
		split.get("lead-c") === 201,
		"Third assignee gets extra from remainder",
	);
	assert(split.get("lead-d") === 200, "Fourth assignee gets base share");
	assert(split.get("lead-e") === 200, "Fifth assignee gets base share");
	assert(validateSplitTotals(1003, split), "Remainder split totals match");
}

function testPartitionContacts() {
	const contactIds = ["c-1", "c-2", "c-3", "c-4", "c-5"];
	const assigneeIds = ["lead-a", "lead-b"];
	const split = computeEqualSplit(contactIds.length, assigneeIds);
	const partitions = partitionContacts(contactIds, split, assigneeIds);

	assert(partitions.length === 2, "Two partitions created");
	assert(partitions[0]!.assigneeId === "lead-a", "First partition assignee");
	assert(
		partitions[0]!.contactIds.length === 3,
		"First partition gets remainder",
	);
	assert(
		partitions[1]!.contactIds.length === 2,
		"Second partition gets base share",
	);
	assert(
		partitions.flatMap(partition => partition.contactIds).join(",") ===
			contactIds.join(","),
		"All contacts partitioned in order",
	);
}

function testEqualSplitWithFewerContactsThanAssignees() {
	const assigneeIds = ["tp-a", "tp-b", "tp-c", "tp-d", "tp-e"];
	const split = computeEqualSplit(3, assigneeIds);

	assert(split.get("tp-a") === 1, "First telepastor gets one contact");
	assert(split.get("tp-b") === 1, "Second telepastor gets one contact");
	assert(split.get("tp-c") === 1, "Third telepastor gets one contact");
	assert(split.get("tp-d") === 0, "Fourth telepastor gets zero");
	assert(split.get("tp-e") === 0, "Fifth telepastor gets zero");
}

function testRetainContactsForCallingRoles() {
	assert(
		canRetainContactsForCalling("GOVERNOR"),
		"Governor can retain contacts",
	);
	assert(canRetainContactsForCalling("LEADER"), "Leader can retain contacts");
	assert(
		!canRetainContactsForCalling("TELEPASTOR"),
		"Telepastor cannot retain in distribution",
	);
	assert(
		!canRetainContactsForCalling("SUPER_ADMIN"),
		"Super Admin cannot retain in distribution",
	);
}

function testDefaultRetainCount() {
	assert(getDefaultRetainCount(1000, true) === 50, "Default retain is 50");
	assert(
		getDefaultRetainCount(20, true) === 20,
		"Default retain capped by pool",
	);
	assert(
		getDefaultRetainCount(1000, false) === 0,
		"Non-retaining roles get zero",
	);
}

function testSplitPoolForRetention() {
	const contactIds = ["c-1", "c-2", "c-3", "c-4", "c-5"];
	const { retained, distributable } = splitPoolForRetention(contactIds, 2);

	assert(retained.join(",") === "c-1,c-2", "Retained contacts come first");
	assert(
		distributable.join(",") === "c-3,c-4,c-5",
		"Remaining contacts are distributable",
	);
}

function testDistributionTotalsWithRetention() {
	const assigneeIds = ["lead-a", "lead-b"];
	const retainCount = 50;
	const poolTotal = 1000;
	const split = computeEqualSplit(poolTotal - retainCount, assigneeIds);

	assert(
		validateDistributionTotals(poolTotal, retainCount, split),
		"Retain plus downstream split matches pool total",
	);
}

function testReassignmentPreservesHistory() {
	const history: AssignmentRecord[] = [];

	function assign(contactId: string, assigneeId: string, assignedBy: string) {
		const active = history.find(
			entry => entry.contact_id === contactId && entry.ended_at === null,
		);
		const newId = `asgn-${history.length + 1}`;
		const now = new Date().toISOString();

		if (active) {
			active.ended_at = now;
			active.superseded_by = newId;
		}

		history.push({
			id: newId,
			contact_id: contactId,
			assignee_id: assigneeId,
			assigned_by: assignedBy,
			ended_at: null,
			superseded_by: null,
		});
	}

	assign("contact-1", "lead-a", "gov-a");
	assign("contact-1", "lead-b", "gov-a");

	const ended = history.filter(entry => entry.ended_at !== null);
	assert(ended.length === 1, "Previous assignment retained in history");
	assert(ended[0]!.assignee_id === "lead-a", "Previous assignee recorded");
}

function testReassignmentResetsLatestResponse() {
	type ContactState = {
		latest_response: string | null;
		current_assignee_id: string;
		assignment_status: string;
	};

	function reassign(
		contact: ContactState,
		newAssigneeId: string,
	): ContactState {
		return {
			...contact,
			current_assignee_id: newAssigneeId,
			assignment_status: "ASSIGNED",
			latest_response: null,
		};
	}

	const before = {
		latest_response: "COMING",
		current_assignee_id: "tp-a",
		assignment_status: "IN_PROGRESS",
	};

	const after = reassign(before, "tp-b");

	assert(after.latest_response === null, "Reassignment clears latest response");
	assert(after.current_assignee_id === "tp-b", "Reassignment updates assignee");
	assert(after.assignment_status === "ASSIGNED", "Reassignment resets status");
}

function testDownstreamReassignmentPermissions() {
	const superAdmin = makeTelepastor({ id: "sa-1", role: "SUPER_ADMIN" });
	const governorA = makeTelepastor({ id: "gov-a", role: "GOVERNOR" });
	const leaderA = makeTelepastor({
		id: "lead-a",
		role: "LEADER",
		governor_id: "gov-a",
	});
	const telepastorA = makeTelepastor({
		id: "tp-a",
		role: "TELEPASTOR",
		leader_id: "lead-a",
	});

	const assignedToGovernor = {
		id: "c-1",
		campaign_id: "camp-1",
		assignment_status: "ASSIGNED",
		current_assignee_id: "gov-a",
	};

	const assignedToLeader = {
		id: "c-2",
		campaign_id: "camp-1",
		assignment_status: "ASSIGNED",
		current_assignee_id: "lead-a",
	};

	assert(
		canAssignContact(contextFor(governorA), assignedToGovernor),
		"Governor can reassign contacts currently assigned to self",
	);
	assert(
		canAssignContactToAssignee(contextFor(governorA), leaderA),
		"Governor can assign to leader in org",
	);
	assert(
		canAssignContact(contextFor(leaderA), assignedToLeader),
		"Leader can reassign contacts currently assigned to self",
	);
	assert(
		canAssignContactToAssignee(contextFor(leaderA), telepastorA),
		"Leader can assign to telepastor in team",
	);

	const history: AssignmentRecord[] = [];

	function assign(contactId: string, assigneeId: string, assignedBy: string) {
		const active = history.find(
			entry => entry.contact_id === contactId && entry.ended_at === null,
		);
		const newId = `asgn-${history.length + 1}`;
		const now = new Date().toISOString();

		if (active) {
			active.ended_at = now;
			active.superseded_by = newId;
		}

		history.push({
			id: newId,
			contact_id: contactId,
			assignee_id: assigneeId,
			assigned_by: assignedBy,
			ended_at: null,
			superseded_by: null,
		});
	}

	assign("contact-1", "gov-a", "sa-1");
	assign("contact-1", "lead-a", "gov-a");
	assign("contact-1", "tp-a", "lead-a");

	assert(
		history.length === 3,
		"Super Admin -> Governor -> Leader -> Telepastor chain preserved",
	);
	assert(
		history.filter(entry => entry.ended_at !== null).length === 2,
		"Two prior assignments ended in downstream chain",
	);
}

function testDistributionPoolExcludesRetainedContacts() {
	const governorId = "gov-a";
	const superAdminId = "sa-1";

	assert(
		isContactReadyForDownstreamDistribution(
			{
				current_assignee_id: governorId,
				assignment_status: "ASSIGNED",
			},
			{ assigned_by: superAdminId, assignee_id: governorId, notes: null },
			governorId,
			"assigned_to_self",
		),
		"Upstream assignment is still ready to distribute",
	);

	assert(
		!isContactReadyForDownstreamDistribution(
			{
				current_assignee_id: governorId,
				assignment_status: "ASSIGNED",
				held_for_own_calls: true,
			},
			{ assigned_by: superAdminId, assignee_id: governorId, notes: null },
			governorId,
			"assigned_to_self",
		),
		"Held-for-own-calls contact is excluded from distribution pool",
	);

	assert(
		isRetainedForCallingAssignment(
			{
				assigned_by: governorId,
				assignee_id: governorId,
				notes: RETAINED_FOR_CALLING_NOTE,
			},
			governorId,
		),
		"Retained marker is detected",
	);
}

function testCalledContactClassification() {
	assert(
		!isContactCalledForCurrentWork(
			{
				latest_response: null,
				current_assignment_id: "asgn-1",
				current_assignee_id: "tp-a",
			},
			[],
		),
		"No response and no attempts is uncalled",
	);

	assert(
		isContactCalledForCurrentWork(
			{
				latest_response: "UNREACHABLE",
				current_assignment_id: "asgn-1",
				current_assignee_id: "tp-a",
			},
			[],
		),
		"Saved response counts as called",
	);

	assert(
		isContactCalledForCurrentWork(
			{
				latest_response: null,
				current_assignment_id: "asgn-1",
				current_assignee_id: "tp-a",
			},
			[{ assignment_id: "asgn-1", telepastor_id: "tp-a" }],
		),
		"Attempt on current assignment counts as called",
	);

	assert(
		!isContactCalledForCurrentWork(
			{
				latest_response: null,
				current_assignment_id: "asgn-2",
				current_assignee_id: "tp-b",
			},
			[{ assignment_id: "asgn-1", telepastor_id: "tp-a" }],
		),
		"Older assignee attempts do not count after reassignment",
	);

	assert(
		isContactCalledForCurrentWork(
			{
				latest_response: null,
				current_assignment_id: null,
				current_assignee_id: null,
			},
			[{ assignment_id: "asgn-1", telepastor_id: "tp-a" }],
		),
		"Unassigned contacts with any attempt are called",
	);

	const partitioned = partitionCalledStatusRows([
		{ contactId: "fresh", currentAssigneeId: "tp-a", isCalled: false },
		{ contactId: "tried", currentAssigneeId: "tp-a", isCalled: true },
	]);
	assert(partitioned.uncalledIds.join(",") === "fresh", "Uncalled partition");
	assert(partitioned.calledIds.join(",") === "tried", "Called partition");

	const preview = summarizeUndoAssigneePreview(
		["fresh", "tried", "moved"],
		"tp-a",
		[
			{ contactId: "fresh", currentAssigneeId: "tp-a", isCalled: false },
			{ contactId: "tried", currentAssigneeId: "tp-a", isCalled: true },
			{ contactId: "moved", currentAssigneeId: "tp-b", isCalled: false },
		],
	);
	assert(preview.noAttemptsCount === 1, "Undo preview uncalled count");
	assert(preview.withAttemptsCount === 1, "Undo preview called count");
	assert(preview.alreadyMovedCount === 1, "Undo preview already-moved count");
}

function testAssigneeUndoAggregation() {
	const rows = aggregateAssigneeUndoRows(
		[
			{ contactId: "c1", assigneeId: "lead-b", isCalled: false },
			{ contactId: "c2", assigneeId: "lead-a", isCalled: true },
			{ contactId: "c3", assigneeId: "lead-a", isCalled: false },
			{ contactId: "c4", assigneeId: "lead-a", isCalled: false },
		],
		new Map([
			["lead-a", { name: "Ama Leader", role: "LEADER" }],
			["lead-b", { name: "Kojo Leader", role: "LEADER" }],
		]),
	);

	assert(rows.length === 2, "One row per assignee");
	assert(rows[0]!.name === "Ama Leader", "Rows sorted by name");
	assert(rows[0]!.assignedCount === 3, "Assigned count includes called and uncalled");
	assert(rows[0]!.attemptedCount === 1, "Attempted count");
	assert(rows[0]!.unattemptedCount === 2, "Not attempted count");
	assert(rows[1]!.assignedCount === 1, "Second assignee assigned count");
	assert(rows[1]!.unattemptedCount === 1, "Second assignee unattempted count");
}

function main() {
	testDistributionPermissions();
	testContactPoolPermissions();
	testAssignmentHistoryModel();
	testBulkAssignmentCounts();
	testEqualSplitRemainder();
	testPartitionContacts();
	testEqualSplitWithFewerContactsThanAssignees();
	testRetainContactsForCallingRoles();
	testDefaultRetainCount();
	testSplitPoolForRetention();
	testDistributionTotalsWithRetention();
	testReassignmentPreservesHistory();
	testReassignmentResetsLatestResponse();
	testDownstreamReassignmentPermissions();
	testDistributionPoolExcludesRetainedContacts();
	testCalledContactClassification();
	testAssigneeUndoAggregation();
	console.log("Phase 4 assignment tests passed.");
}

main();
