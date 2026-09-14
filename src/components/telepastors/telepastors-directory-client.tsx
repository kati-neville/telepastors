"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import {
	TelepastorsEmptyState,
	TelepastorsFilters,
} from "@/components/telepastors/telepastors-filters";
import { TelepastorDirectoryStats } from "@/components/telepastors/telepastor-directory-stats";
import { TelepastorMemberCards } from "@/components/telepastors/telepastor-member-cards";
import { TelepastorsTable } from "@/components/telepastors/telepastors-table";
import { Button } from "@/components/ui/button";
import { applyTelepastorDirectoryFilters } from "@/lib/telepastors/directory-filters";
import type { TelepastorDirectoryCounts } from "@/lib/queries/telepastors";
import {
	DEFAULT_TELEPASTORS_FILTERS,
	type TelepastorsFilterValues,
} from "@/lib/validations/telepastors";
import type {
	MinistryRole,
	TelepastorDirectoryEntry,
	TelepastorSummary,
} from "@/types/domain";

type TelepastorsDirectoryClientProps = {
	telepastors: TelepastorDirectoryEntry[];
	counts: TelepastorDirectoryCounts;
	viewerRole: MinistryRole;
	governors: TelepastorSummary[];
	leaders: TelepastorSummary[];
	canCreate: boolean;
	canImport: boolean;
};

export function TelepastorsDirectoryClient({
	telepastors,
	counts,
	viewerRole,
	governors,
	leaders,
	canCreate,
	canImport,
}: TelepastorsDirectoryClientProps) {
	const [filters, setFilters] = useState<TelepastorsFilterValues>(
		DEFAULT_TELEPASTORS_FILTERS,
	);

	const filteredTelepastors = useMemo(
		() => applyTelepastorDirectoryFilters(telepastors, filters),
		[telepastors, filters],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="font-heading text-2xl font-semibold tracking-tight">
						Telepastors
					</h2>
					<p className="text-sm text-muted-foreground">
						Manage ministry members, roles, and organizational placement.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<TelepastorsFilters
						viewerRole={viewerRole}
						governors={governors}
						leaders={leaders}
						filters={filters}
						onFiltersChange={setFilters}
						className="justify-start"
					/>
					{canImport ? (
						<Button
							variant="outline"
							render={<Link href="/telepastors/import" />}
						>
							<Upload />
							Bulk import
						</Button>
					) : null}
					{canCreate ? (
						<Button render={<Link href="/telepastors/new" />}>
							<Plus />
							Add Telepastor
						</Button>
					) : null}
				</div>
			</div>

			<TelepastorDirectoryStats counts={counts} />

			{filteredTelepastors.length === 0 ? (
				<TelepastorsEmptyState canCreate={canCreate} canImport={canImport} />
			) : (
				<>
					<TelepastorsTable telepastors={filteredTelepastors} />
					<TelepastorMemberCards telepastors={filteredTelepastors} />
				</>
			)}
		</div>
	);
}
