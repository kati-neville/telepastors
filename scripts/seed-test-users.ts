import "dotenv/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../src/lib/supabase/admin";
import type { Database } from "../src/types/database";

type MinistryRole = Database["public"]["Tables"]["telepastors"]["Row"]["role"];

const TEST_PASSWORD = "password";
const DEFAULT_EMAIL_DOMAIN = "telepastors.local";

type SeedUserSpec = {
	key: string;
	role: MinistryRole;
	emailLocalPart: string;
	name: string;
	phone: string;
	address: string;
	governorKey?: string;
	leaderKey?: string;
};

const SEED_USERS: SeedUserSpec[] = [
	{
		key: "SUPER_ADMIN",
		role: "SUPER_ADMIN",
		emailLocalPart: "superadmin",
		name: "Test Super Admin",
		phone: "0200000001",
		address: "Test HQ",
	},
	{
		key: "GOVERNOR",
		role: "GOVERNOR",
		emailLocalPart: "governor",
		name: "Test Governor",
		phone: "0200000002",
		address: "Test Governor Office",
	},
	{
		key: "LEADER",
		role: "LEADER",
		emailLocalPart: "leader",
		name: "Test Leader",
		phone: "0200000003",
		address: "Test Leader Office",
		governorKey: "GOVERNOR",
	},
	{
		key: "TELEPASTOR",
		role: "TELEPASTOR",
		emailLocalPart: "telepastor",
		name: "Test Telepastor",
		phone: "0200000004",
		address: "Test Telepastor Address",
		leaderKey: "LEADER",
	},
];

type CreatedSeedUser = {
	key: string;
	role: MinistryRole;
	email: string;
	name: string;
	telepastorId: string;
	authUserId: string;
	created: boolean;
};

async function findAuthUserByEmail(
	supabase: SupabaseClient<Database, "public">,
	email: string,
) {
	let page = 1;

	while (true) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 200,
		});

		if (error) {
			throw new Error(`Failed to list auth users: ${error.message}`);
		}

		const match = data.users.find(
			user => user.email?.toLowerCase() === email.toLowerCase(),
		);

		if (match) {
			return match;
		}

		if (data.users.length < 200) {
			return null;
		}

		page += 1;
	}
}

async function upsertSeedUser(
	supabase: SupabaseClient<Database, "public">,
	spec: SeedUserSpec,
	email: string,
	createdUsers: Map<string, CreatedSeedUser>,
): Promise<CreatedSeedUser> {
	const existingProfile = await supabase
		.from("telepastors")
		.select("id, auth_user_id, role, name")
		.eq("phone", spec.phone)
		.maybeSingle();

	if (existingProfile.error) {
		throw new Error(
			`Failed to look up telepastor ${spec.key}: ${existingProfile.error.message}`,
		);
	}

	let authUser = await findAuthUserByEmail(supabase, email);
	let created = false;

	if (!authUser) {
		const { data, error } = await supabase.auth.admin.createUser({
			email,
			password: TEST_PASSWORD,
			email_confirm: true,
			user_metadata: {
				seed_key: spec.key,
				seed_role: spec.role,
			},
		});

		if (error || !data.user) {
			throw new Error(
				`Failed to create auth user for ${spec.key}: ${error?.message ?? "Unknown error"}`,
			);
		}

		authUser = data.user;
		created = true;
	} else {
		const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
			password: TEST_PASSWORD,
			email_confirm: true,
		});

		if (error) {
			throw new Error(
				`Failed to update password for ${spec.key}: ${error.message}`,
			);
		}
	}

	const governorId = spec.governorKey
		? (createdUsers.get(spec.governorKey)?.telepastorId ?? null)
		: null;
	const leaderId = spec.leaderKey
		? (createdUsers.get(spec.leaderKey)?.telepastorId ?? null)
		: null;

	if (spec.role === "LEADER" && !governorId) {
		throw new Error(`Missing governor for ${spec.key}.`);
	}

	if (spec.role === "TELEPASTOR" && !leaderId) {
		throw new Error(`Missing leader for ${spec.key}.`);
	}

	const profilePayload = {
		auth_user_id: authUser.id,
		name: spec.name,
		phone: spec.phone,
		address: spec.address,
		role: spec.role,
		is_active: true,
		governor_id: spec.role === "LEADER" ? governorId : null,
		leader_id: spec.role === "TELEPASTOR" ? leaderId : null,
	};

	if (existingProfile.data) {
		const { error } = await supabase
			.from("telepastors")
			.update(profilePayload)
			.eq("id", existingProfile.data.id);

		if (error) {
			throw new Error(
				`Failed to update telepastor ${spec.key}: ${error.message}`,
			);
		}

		return {
			key: spec.key,
			role: spec.role,
			email,
			name: spec.name,
			telepastorId: existingProfile.data.id,
			authUserId: authUser.id,
			created,
		};
	}

	const { data: insertedProfile, error: insertError } = await supabase
		.from("telepastors")
		.insert(profilePayload)
		.select("id")
		.single();

	if (insertError || !insertedProfile) {
		if (created) {
			await supabase.auth.admin.deleteUser(authUser.id);
		}

		throw new Error(
			`Failed to create telepastor ${spec.key}: ${insertError?.message ?? "Unknown error"}`,
		);
	}

	return {
		key: spec.key,
		role: spec.role,
		email,
		name: spec.name,
		telepastorId: insertedProfile.id,
		authUserId: authUser.id,
		created: true,
	};
}

function printSummary(users: CreatedSeedUser[]) {
	console.log(
		"\nTest users ready. Sign in at /login with password: password\n",
	);
	console.log("Role          Email                                 Name");
	console.log(
		"------------  ------------------------------------  ------------------",
	);

	for (const user of users) {
		console.log(
			`${user.role.padEnd(12)}  ${user.email.padEnd(36)}  ${user.name}`,
		);
	}

	console.log("\nHierarchy for assignment testing:");
	console.log("  Test Governor -> Test Leader -> Test Telepastor");
	console.log(
		"\nTip: use an incognito window per role to compare views side by side.",
	);
}

async function main() {
	if (process.env.NODE_ENV === "production") {
		console.warn(
			"Warning: seeding test users in production is not recommended.",
		);
	}

	const emailDomain = process.env.SEED_EMAIL_DOMAIN ?? DEFAULT_EMAIL_DOMAIN;
	const supabase = createServiceRoleClient();
	const createdUsers = new Map<string, CreatedSeedUser>();
	const results: CreatedSeedUser[] = [];

	for (const spec of SEED_USERS) {
		const email = `${spec.emailLocalPart}@${emailDomain}`;
		const result = await upsertSeedUser(supabase, spec, email, createdUsers);
		createdUsers.set(spec.key, result);
		results.push(result);

		console.log(
			`${result.created ? "Created" : "Updated"} ${spec.role}: ${email}`,
		);
	}

	printSummary(results);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
