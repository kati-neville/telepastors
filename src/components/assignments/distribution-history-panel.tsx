"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
	listCampaignDistributionJobsAction,
	undoDistributionJobAction,
} from "@/app/actions/assignments";
import type { DistributionJobSummary } from "@/lib/assignments/undo-distribution";
import { Button } from "@/components/ui/button";
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function formatWhen(value: string | null) {
	if (!value) return "Unknown time";
	try {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
}

type DistributionHistoryPanelProps = {
	campaignId: string;
	assigneeLabel: string;
	refreshKey?: number;
};

export function DistributionHistoryPanel({
	campaignId,
	assigneeLabel,
	refreshKey = 0,
}: DistributionHistoryPanelProps) {
	const router = useRouter();
	const [jobs, setJobs] = useState<DistributionJobSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [undoingKey, setUndoingKey] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		setLoading(true);
		void listCampaignDistributionJobsAction(campaignId).then(result => {
			if (cancelled) return;
			if (!result.success) {
				setJobs([]);
				setLoading(false);
				return;
			}
			setJobs(result.data ?? []);
			setLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [campaignId, refreshKey]);

	const handleUndo = (
		jobId: string,
		assigneeId: string,
		assigneeName: string,
	) => {
		const key = `${jobId}:${assigneeId}`;
		setUndoingKey(key);
		startTransition(async () => {
			const result = await undoDistributionJobAction(jobId, assigneeId);

			if (!result.success) {
				toast.error(result.error);
				setUndoingKey(null);
				return;
			}

			const reclaimed = result.data?.reclaimedCount ?? 0;
			const blocked = result.data?.blockedCount ?? 0;

			toast.success(
				blocked > 0
					? `Reclaimed ${reclaimed} contact${reclaimed === 1 ? "" : "s"} from ${assigneeName}. ${blocked} could not be undone (already redistributed).`
					: `Reclaimed ${reclaimed} contact${reclaimed === 1 ? "" : "s"} from ${assigneeName}.`,
			);

			setJobs(current =>
				current.map(job =>
					job.id === jobId && result.data?.job ? result.data.job : job,
				),
			);
			setUndoingKey(null);
			router.refresh();
		});
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading distribution history…
				</CardContent>
			</Card>
		);
	}

	if (jobs.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			{jobs.map(job => {
				const undoneById = new Map(
					job.undoneAssignees.map(entry => [entry.assigneeId, entry]),
				);
				const undoneCount = job.undoneAssignees.length;
				const undoableCount = job.byAssignee.filter(
					assignee => assignee.count > 0,
				).length;

				return (
					<Card key={job.id}>
						<CardHeader className="pb-3">
							<div className="space-y-1">
								<CardTitle className="text-base">
									{job.status === "undone"
										? "Distribution fully undone"
										: undoneCount > 0
											? "Distribution partially undone"
											: "Distribution completed"}
								</CardTitle>
								<CardDescription>
									{formatWhen(job.completedAt)} · {job.assignedCount}{" "}
									distributed
									{job.retainCount > 0
										? ` · ${job.retainCount} kept for calls`
										: ""}
									{undoneCount > 0
										? ` · ${undoneCount} of ${undoableCount || undoneCount} ${assigneeLabel.toLowerCase()}${undoableCount === 1 ? "" : "s"} undone`
										: ""}
								</CardDescription>
							</div>
						</CardHeader>
						<CardContent>
							{job.byAssignee.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No assignee breakdown was stored for this job.
								</p>
							) : (
								<div className="overflow-hidden rounded-xl border">
									<div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/30 px-4 py-3 text-sm font-medium">
										<span>{assigneeLabel}</span>
										<span>Contacts</span>
										<span className="text-right">Action</span>
									</div>
									{job.byAssignee.map(assignee => {
										const undone = undoneById.get(assignee.assigneeId);
										const canUndo =
											job.status === "completed" &&
											assignee.count > 0 &&
											!undone;
										const rowKey = `${job.id}:${assignee.assigneeId}`;
										const isUndoing = undoingKey === rowKey && isPending;

										return (
											<div
												key={assignee.assigneeId}
												className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
												<div>
													<p className="font-medium">{assignee.name}</p>
													{undone ? (
														<p className="text-xs text-muted-foreground">
															Undone · reclaimed {undone.reclaimedCount}
															{undone.blockedCount > 0
																? `, blocked ${undone.blockedCount}`
																: ""}
														</p>
													) : null}
												</div>
												<span className="tabular-nums">{assignee.count}</span>
												<div className="justify-self-end">
													{canUndo ? (
														<AlertDialog>
															<AlertDialogTrigger
																render={
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		disabled={isPending}>
																		{isUndoing ? (
																			<>
																				<Loader2 className="animate-spin" />
																				Undoing...
																			</>
																		) : (
																			<>
																				<Undo2 />
																				Undo
																			</>
																		)}
																	</Button>
																}
															/>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Undo distribution to {assignee.name}?
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		Only contacts still held by {assignee.name}{" "}
																		from this distribution will return to your
																		pool. Other {assigneeLabel.toLowerCase()}s
																		are not affected. Contacts already
																		redistributed further will be skipped.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel disabled={isPending}>
																		Cancel
																	</AlertDialogCancel>
																	<AlertDialogAction
																		disabled={isPending}
																		onClick={event => {
																			event.preventDefault();
																			handleUndo(
																				job.id,
																				assignee.assigneeId,
																				assignee.name,
																			);
																		}}>
																		Confirm undo
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													) : undone ? (
														<span className="text-xs text-muted-foreground">
															Undone
														</span>
													) : (
														<span className="text-xs text-muted-foreground">
															—
														</span>
													)}
												</div>
											</div>
										);
									})}
									<div className="grid grid-cols-[1fr_auto_auto] gap-3 border-t bg-muted/20 px-4 py-3 text-sm font-medium">
										<span>Pool total</span>
										<span className="tabular-nums">{job.poolTotal}</span>
										<span />
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
