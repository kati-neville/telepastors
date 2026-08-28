"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
	getDistributionJobStatusAction,
	startDistributionJobAction,
} from "@/app/actions/assignments";
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
import { Progress } from "@/components/ui/progress";
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

type DistributionProgress = {
	phase: "preparing" | "assigning" | "finalizing" | "completed";
	completed: number;
	total: number;
};

export function EqualSplitPanel({
	campaignId,
	actorRole,
	poolContactCount,
	assignees,
}: EqualSplitPanelProps) {
	const router = useRouter();
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
	const [dialogOpen, setDialogOpen] = useState(false);
	const [isDistributing, setIsDistributing] = useState(false);
	const [progress, setProgress] = useState<DistributionProgress | null>(null);
	const [activeJobId, setActiveJobId] = useState<string | null>(null);

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
		!isDistributing;
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

	const handleDialogOpenChange = (open: boolean) => {
		if (isDistributing && activeJobId) {
			setDialogOpen(false);
			return;
		}

		if (isDistributing) {
			return;
		}

		setDialogOpen(open);
		if (!open) {
			setProgress(null);
			setActiveJobId(null);
		}
	};

	useEffect(() => {
		if (!activeJobId) {
			return;
		}

		let cancelled = false;

		const pollJob = async () => {
			const status = await getDistributionJobStatusAction(activeJobId);

			if (cancelled || !status.success || !status.data) {
				return;
			}

			const {
				status: jobStatus,
				progressCompleted,
				progressTotal,
				assignedCount,
				errorMessage,
				byAssignee,
			} = status.data;

			if (jobStatus === "pending") {
				setProgress(current => ({
					phase: "preparing",
					completed: 0,
					total: current?.total ?? progressTotal,
				}));
				return;
			}

			if (jobStatus === "running") {
				setProgress({
					phase: "assigning",
					completed: progressCompleted,
					total: progressTotal,
				});
				return;
			}

			if (jobStatus === "completed") {
				const assigneeCount = byAssignee.filter(item => item.count > 0).length;

				setProgress({
					phase: "completed",
					completed: progressTotal,
					total: progressTotal,
				});
				setIsDistributing(false);
				setActiveJobId(null);
				setDialogOpen(false);
				setProgress(null);

				toast.success(
					retainCount > 0
						? `${retainCount} kept for your calls. ${assignedCount} contacts distributed among ${assigneeCount || sortedAssignees.length} ${assigneeLabelPlural}.`
						: `${assignedCount} contacts distributed among ${assigneeCount || sortedAssignees.length} ${assigneeLabelPlural}.`,
				);
				router.refresh();
				return;
			}

			if (jobStatus === "failed") {
				setIsDistributing(false);
				setActiveJobId(null);
				setProgress(null);
				toast.error(errorMessage ?? "Distribution failed.");
				router.refresh();
			}
		};

		void pollJob();
		const intervalId = window.setInterval(() => {
			void pollJob();
		}, 1500);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, [
		activeJobId,
		assigneeLabelPlural,
		retainCount,
		router,
		sortedAssignees.length,
	]);

	const handleDistribute = async () => {
		if (!canDistribute) {
			return;
		}

		setIsDistributing(true);
		setProgress({
			phase: "preparing",
			completed: 0,
			total: retainOnly ? retainCount : assignedTotal,
		});

		const requestPayload = {
			campaignId,
			retainCount: canRetain ? retainCount : 0,
			assignments: sortedAssignees.map(assignee => ({
				assigneeId: assignee.id,
				count: counts[assignee.id] ?? 0,
			})),
		};

		try {
			const started = await startDistributionJobAction(requestPayload);

			if (!started.success) {
				toast.error(started.error);
				if (started.error.includes("pool changed")) {
					router.refresh();
				}
				setIsDistributing(false);
				setProgress(null);
				return;
			}

			setActiveJobId(started.data!.jobId);
			setProgress({
				phase: "preparing",
				completed: 0,
				total: retainOnly ? retainCount : assignedTotal,
			});
			toast.message("Distribution started in the background.", {
				description: "You can close this dialog or leave the page.",
			});
		} catch {
			toast.error("Failed to start distribution.");
			setIsDistributing(false);
			setProgress(null);
		}
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

	const progressLabel =
		progress?.phase === "preparing"
			? "Preparing distribution..."
			: progress?.phase === "finalizing"
				? "Finalizing distribution..."
				: `Assigning contacts (${progress?.completed ?? 0} of ${progress?.total ?? 0})`;

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
							disabled={isDistributing}
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
									disabled={isDistributing}
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
						<Button
							type="button"
							variant="outline"
							onClick={resetToEqual}
							disabled={isDistributing}>
							<RotateCcw />
							Reset to equal
						</Button>

						<AlertDialog
							open={dialogOpen}
							onOpenChange={handleDialogOpenChange}>
							<AlertDialogTrigger
								render={
									<Button disabled={!canDistribute}>
										{isDistributing ? (
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
							<AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-[calc(100vw-1.5rem)] gap-5 sm:max-w-xl">
								<AlertDialogHeader className="text-left sm:place-items-start sm:text-left">
									<AlertDialogTitle>
										{isDistributing
											? "Distributing contacts"
											: retainOnly
												? "Confirm keep for my calls"
												: "Confirm distribution"}
									</AlertDialogTitle>
									{isDistributing ? (
										<div className="space-y-4 pt-1 text-left text-sm text-muted-foreground">
											<div className="flex items-center gap-2">
												<Loader2 className="size-4 animate-spin" />
												<span>{progressLabel}</span>
											</div>
											<Progress
												value={progress?.completed ?? 0}
												max={Math.max(progress?.total ?? 1, 1)}
											/>
											<p className="text-xs">
												Distribution runs in the background on the server. You
												can close this dialog or navigate away. A notification
												will appear when it finishes.
											</p>
										</div>
									) : (
										<div className="space-y-4 pt-1 text-left">
											<AlertDialogDescription>
												{retainOnly
													? `Keep all ${retainCount} contact${retainCount === 1 ? "" : "s"} assigned to you for your own calls? They will be removed from the distribution queue.`
													: canRetain && retainCount > 0
														? `You are about to keep ${retainCount} contacts for your calls and distribute ${assignedTotal} among ${sortedAssignees.length} ${assigneeLabelPlural}.`
														: `You are about to distribute ${assignedTotal} contacts among ${sortedAssignees.length} ${assigneeLabelPlural}.`}
											</AlertDialogDescription>

											{!retainOnly ? (
												<div className="space-y-3">
													{canRetain && retainCount > 0 ? (
														<div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
															<span className="text-muted-foreground">
																Keep for my calls
															</span>
															<span className="font-medium tabular-nums">
																{retainCount}
															</span>
														</div>
													) : null}

													<div className="overflow-hidden rounded-lg border">
														<div className="grid grid-cols-[1fr_auto] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
															<span>{assigneeLabel}</span>
															<span>Contacts</span>
														</div>
														<div className="max-h-[min(40vh,16rem)] overflow-y-auto sm:max-h-48">
															{sortedAssignees.map(assignee => {
																const count = counts[assignee.id] ?? 0;

																return (
																	<div
																		key={assignee.id}
																		className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-3 py-2.5 text-sm last:border-b-0">
																		<span className="truncate font-medium">
																			{assignee.name}
																		</span>
																		<span className="font-medium tabular-nums">
																			{count}
																		</span>
																	</div>
																);
															})}
														</div>
														<div className="grid grid-cols-[1fr_auto] gap-3 border-t bg-muted/20 px-3 py-2 text-sm font-medium">
															<span>To distribute</span>
															<span className="tabular-nums">
																{assignedTotal}
															</span>
														</div>
													</div>

													<p className="text-xs text-muted-foreground">
														Previous assignments will be preserved in history.
													</p>
												</div>
											) : null}
										</div>
									)}
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel disabled={isDistributing}>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={event => {
											event.preventDefault();
											void handleDistribute();
										}}
										disabled={isDistributing}>
										{isDistributing ? (
											<>
												<Loader2 className="animate-spin" />
												Distributing...
											</>
										) : retainOnly ? (
											"Confirm keep"
										) : (
											"Confirm distribution"
										)}
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
