"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { bulkAssignContactsAction } from "@/app/actions/assignments";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	buildEqualSplitCounts,
	getDefaultRetainCount,
} from "@/lib/assignments/distribute-equally";
import {
	canRetainContactsForCalling,
	getAssigneeLabel,
} from "@/lib/auth/assignments";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";

type EqualSplitPanelProps = {
	campaignId: string;
	actorRole: MinistryRole;
	poolContactCount: number;
	assignees: TelepastorSummary[];
};

export function EqualSplitPanel({
	campaignId,
	actorRole,
	poolContactCount,
	assignees,
}: EqualSplitPanelProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const assigneeLabel = getAssigneeLabel(actorRole);
	const assigneeLabelPlural = `${assigneeLabel.toLowerCase()}s`;
	const canRetain = canRetainContactsForCalling(actorRole);

	const sortedAssignees = useMemo(
		() => [...assignees].sort((a, b) => a.name.localeCompare(b.name)),
		[assignees],
	);

	const sortedAssigneeIds = useMemo(
		() => sortedAssignees.map(assignee => assignee.id),
		[sortedAssignees],
	);

	const initialRetainCount = getDefaultRetainCount(poolContactCount, canRetain);

	const [retainCount, setRetainCount] = useState(initialRetainCount);
	const [counts, setCounts] = useState<Record<string, number>>(() =>
		buildEqualSplitCounts(
			poolContactCount,
			sortedAssigneeIds,
			initialRetainCount,
		),
	);

	const distributableCount = Math.max(0, poolContactCount - retainCount);

	const assignedTotal = useMemo(
		() => Object.values(counts).reduce((sum, count) => sum + count, 0),
		[counts],
	);

	const totalsMatch = retainCount + assignedTotal === poolContactCount;
	const defaultPerAssignee =
		sortedAssignees.length > 0
			? Math.floor(distributableCount / sortedAssignees.length)
			: 0;

	const canDistribute =
		poolContactCount > 0 &&
		sortedAssignees.length > 0 &&
		totalsMatch &&
		!isPending;
	const retainOnly = canRetain && distributableCount === 0 && retainCount > 0;

	const updateSplitForRetain = (nextRetainCount: number) => {
		setRetainCount(nextRetainCount);
		setCounts(
			buildEqualSplitCounts(
				poolContactCount,
				sortedAssigneeIds,
				nextRetainCount,
			),
		);
	};

	const handleRetainChange = (value: string) => {
		const parsed = Number.parseInt(value, 10);
		const nextRetain = Number.isNaN(parsed)
			? 0
			: Math.max(0, Math.min(parsed, poolContactCount));
		updateSplitForRetain(nextRetain);
	};

	const handleCountChange = (assigneeId: string, value: string) => {
		const parsed = Number.parseInt(value, 10);
		setCounts(current => ({
			...current,
			[assigneeId]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
		}));
	};

	const resetToEqual = () => {
		updateSplitForRetain(getDefaultRetainCount(poolContactCount, canRetain));
	};

	const handleDistribute = () => {
		if (!canDistribute) {
			return;
		}

		startTransition(async () => {
			const result = await bulkAssignContactsAction({
				campaignId,
				retainCount: canRetain ? retainCount : 0,
				assignments: sortedAssignees.map(assignee => ({
					assigneeId: assignee.id,
					count: counts[assignee.id] ?? 0,
				})),
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			const assigneeCount = result.data?.byAssignee.filter(
				item => item.count > 0,
			).length;

			toast.success(
				retainCount > 0
					? `${retainCount} kept for your calls. ${result.data?.assignedCount ?? assignedTotal} contacts distributed among ${assigneeCount ?? sortedAssignees.length} ${assigneeLabelPlural}.`
					: `${result.data?.assignedCount ?? assignedTotal} contacts distributed among ${assigneeCount ?? sortedAssignees.length} ${assigneeLabelPlural}.`,
			);
			router.refresh();
		});
	};

	if (sortedAssignees.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Distribute equally among {assigneeLabelPlural}
					</CardTitle>
					<CardDescription>
						No {assigneeLabelPlural} are available in your organization.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (poolContactCount === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Distribute equally among {assigneeLabelPlural}
					</CardTitle>
					<CardDescription>
						No contacts are ready to assign in your distribution pool.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Distribute equally among {assigneeLabelPlural}
				</CardTitle>
				<CardDescription>
					{canRetain
						? `Keep contacts for your own calls, then split the remaining ${distributableCount} across ${sortedAssignees.length} ${assigneeLabelPlural}.`
						: `Split all ${poolContactCount} ready contacts across ${sortedAssignees.length} ${assigneeLabelPlural}. Default share: ${defaultPerAssignee} each, with any remainder assigned in name order.`}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div
					className={`grid gap-3 ${canRetain ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
					<div className="rounded-lg border bg-muted/20 px-4 py-3">
						<p className="text-xs text-muted-foreground">
							Contacts in your pool
						</p>
						<p className="text-2xl font-semibold">{poolContactCount}</p>
					</div>
					{canRetain ? (
						<div className="rounded-lg border bg-muted/20 px-4 py-3">
							<p className="text-xs text-muted-foreground">Keep for my calls</p>
							<p className="text-2xl font-semibold">{retainCount}</p>
						</div>
					) : null}
					<div className="rounded-lg border bg-muted/20 px-4 py-3">
						<p className="text-xs text-muted-foreground">To distribute</p>
						<p className="text-2xl font-semibold">{distributableCount}</p>
					</div>
					<div className="rounded-lg border bg-muted/20 px-4 py-3">
						<p className="text-xs text-muted-foreground">
							{assigneeLabel}s available
						</p>
						<p className="text-2xl font-semibold">{sortedAssignees.length}</p>
					</div>
				</div>

				{canRetain ? (
					<div className="max-w-xs space-y-2">
						<Label htmlFor="retain-count">Keep for my calls</Label>
						<Input
							id="retain-count"
							type="number"
							min={0}
							max={poolContactCount}
							value={retainCount}
							onChange={event => handleRetainChange(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							These contacts stay assigned to you for your calls. Default is 50.
						</p>
					</div>
				) : null}

				<div className="rounded-xl border">
					<div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium">
						<span>{assigneeLabel}</span>
						<span>Contacts to receive</span>
					</div>
					{sortedAssignees.map(assignee => (
						<div
							key={assignee.id}
							className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0">
							<span className="font-medium">{assignee.name}</span>
							<div className="w-28">
								<Label htmlFor={`split-${assignee.id}`} className="sr-only">
									Contacts for {assignee.name}
								</Label>
								<Input
									id={`split-${assignee.id}`}
									type="number"
									min={0}
									value={counts[assignee.id] ?? 0}
									onChange={event =>
										handleCountChange(assignee.id, event.target.value)
									}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3">
					<p
						className={`text-sm ${
							totalsMatch ? "text-muted-foreground" : "text-destructive"
						}`}>
						{totalsMatch
							? canRetain
								? `Total: ${retainCount} kept for you + ${assignedTotal} to distribute = ${poolContactCount}`
								: `Total assigned: ${assignedTotal} of ${poolContactCount}`
							: canRetain
								? `Retained (${retainCount}) plus assigned (${assignedTotal}) must equal ${poolContactCount} contacts.`
								: `Total assigned (${assignedTotal}) must equal ${poolContactCount} contacts.`}
					</p>

					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" onClick={resetToEqual}>
							<RotateCcw />
							Reset to equal
						</Button>

						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button disabled={!canDistribute}>
										{isPending ? (
											<>
												<Loader2 className="animate-spin" />
												Distributing...
											</>
										) : retainOnly ? (
											<>
												<Share2 />
												Confirm keep for my calls
											</>
										) : (
											<>
												<Share2 />
												Confirm & distribute
											</>
										)}
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{retainOnly
											? "Confirm keep for my calls"
											: "Confirm distribution"}
									</AlertDialogTitle>
									<AlertDialogDescription>
										{retainOnly
											? `Keep all ${retainCount} contact${retainCount === 1 ? "" : "s"} assigned to you for your own calls? They will be removed from the distribution queue.`
											: canRetain && retainCount > 0
											? `Keep ${retainCount} contacts for your calls and distribute ${assignedTotal} among ${sortedAssignees.length} ${assigneeLabelPlural}? `
											: `Distribute ${assignedTotal} contacts among ${sortedAssignees.length} ${assigneeLabelPlural}? `}
										{retainOnly
											? ""
											: `${sortedAssignees
													.map(
														assignee =>
															`${assignee.name}: ${counts[assignee.id] ?? 0}`,
													)
													.join(" · ")}. Previous assignments will be preserved in history.`}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel disabled={isPending}>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleDistribute}
										disabled={isPending}>
										{retainOnly ? "Confirm keep" : "Confirm distribution"}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
