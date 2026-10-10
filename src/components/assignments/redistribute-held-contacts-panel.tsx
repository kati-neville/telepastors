"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
	getDistributionJobStatusAction,
	startHeldContactsDistributionJobAction,
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { getAssigneeLabel } from "@/lib/auth/assignments";
import type { MinistryRole, TelepastorSummary } from "@/types/domain";

type RedistributeHeldContactsPanelProps = {
	campaignId: string;
	actorRole: MinistryRole;
	heldContactCount: number;
	assignees: TelepastorSummary[];
	onCompleted?: () => void;
};

type DistributionProgress = {
	phase: "preparing" | "assigning" | "completed";
	completed: number;
	total: number;
};

export function RedistributeHeldContactsPanel({
	campaignId,
	actorRole,
	heldContactCount,
	assignees,
	onCompleted,
}: RedistributeHeldContactsPanelProps) {
	const router = useRouter();
	const assigneeLabel = getAssigneeLabel(actorRole);
	const sortedAssignees = useMemo(
		() => [...assignees].sort((a, b) => a.name.localeCompare(b.name)),
		[assignees],
	);
	const assigneeItems = useMemo(
		() =>
			sortedAssignees.map(assignee => ({
				label: assignee.name,
				value: assignee.id,
			})),
		[sortedAssignees],
	);

	const [count, setCount] = useState(0);
	const [assigneeId, setAssigneeId] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [isDistributing, setIsDistributing] = useState(false);
	const [progress, setProgress] = useState<DistributionProgress | null>(null);
	const [activeJobId, setActiveJobId] = useState<string | null>(null);

	const selectedAssignee = sortedAssignees.find(
		assignee => assignee.id === assigneeId,
	);
	const remainingAfterGive = Math.max(0, heldContactCount - count);
	const canGive =
		heldContactCount > 0 &&
		sortedAssignees.length > 0 &&
		count >= 1 &&
		count <= heldContactCount &&
		Boolean(assigneeId) &&
		!isDistributing;

	const handleCountChange = (value: string) => {
		const parsed = Number.parseInt(value, 10);
		const nextCount = Number.isNaN(parsed)
			? 0
			: Math.max(0, Math.min(parsed, heldContactCount));
		setCount(nextCount);
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
				setIsDistributing(false);
				setActiveJobId(null);
				setDialogOpen(false);
				setProgress(null);
				setCount(0);
				setAssigneeId("");
				toast.success(
					`${assignedCount} contact${assignedCount === 1 ? "" : "s"} given to ${selectedAssignee?.name ?? `the selected ${assigneeLabel.toLowerCase()}`}.`,
				);
				onCompleted?.();
				router.refresh();
				return;
			}

			if (jobStatus === "failed") {
				setIsDistributing(false);
				setActiveJobId(null);
				setProgress(null);
				toast.error(errorMessage ?? "Could not give out kept contacts.");
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
		assigneeLabel,
		onCompleted,
		router,
		selectedAssignee?.name,
	]);

	const handleGive = async () => {
		if (!canGive) {
			return;
		}

		setIsDistributing(true);
		setProgress({
			phase: "preparing",
			completed: 0,
			total: count,
		});

		try {
			const started = await startHeldContactsDistributionJobAction({
				campaignId,
				assigneeId,
				count,
			});

			if (!started.success) {
				toast.error(started.error);
				setIsDistributing(false);
				setProgress(null);
				return;
			}

			setActiveJobId(started.data!.jobId);
			toast.message("Giving contacts in the background.", {
				description: "You can close this dialog or leave the page.",
			});
		} catch {
			toast.error("Failed to start giving kept contacts.");
			setIsDistributing(false);
			setProgress(null);
		}
	};

	const progressLabel =
		progress?.phase === "preparing"
			? "Preparing contacts..."
			: `Assigning contacts (${progress?.completed ?? 0} of ${progress?.total ?? 0})`;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Give kept contacts to one {assigneeLabel.toLowerCase()}
				</CardTitle>
				<CardDescription>
					Send a portion of the contacts you kept for your own calls. The rest
					stay on your call list.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border bg-muted/20 px-4 py-3">
						<p className="text-xs text-muted-foreground">Kept for my calls</p>
						<p className="text-2xl font-semibold">{heldContactCount}</p>
					</div>
					<div className="rounded-lg border bg-muted/20 px-4 py-3">
						<p className="text-xs text-muted-foreground">
							Remaining after this
						</p>
						<p className="text-2xl font-semibold">{remainingAfterGive}</p>
					</div>
				</div>

				{sortedAssignees.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						You need a {assigneeLabel.toLowerCase()} under you before you can
						give kept contacts away.
					</p>
				) : heldContactCount === 0 ? (
					<p className="text-sm text-muted-foreground">
						Keep contacts for your own calls during equal split, then you can
						give some of them to one person under you.
					</p>
				) : (
					<div className="grid items-end gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
						<div className="grid gap-2">
							<Label htmlFor="held-give-count">Contacts to give</Label>
							<Input
								id="held-give-count"
								className="h-8"
								type="number"
								min={0}
								max={heldContactCount}
								value={count}
								onChange={event => handleCountChange(event.target.value)}
								disabled={isDistributing}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="held-give-assignee">{assigneeLabel}</Label>
							<Select
								value={assigneeId}
								items={assigneeItems}
								onValueChange={value => setAssigneeId(value ?? "")}
								disabled={isDistributing}>
								<SelectTrigger
									id="held-give-assignee"
									className="h-8 w-full min-w-0">
									<SelectValue
										placeholder={`Select ${assigneeLabel.toLowerCase()}`}
									/>
								</SelectTrigger>
								<SelectContent>
									{sortedAssignees.map(assignee => (
										<SelectItem key={assignee.id} value={assignee.id}>
											{assignee.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<AlertDialog
							open={dialogOpen}
							onOpenChange={handleDialogOpenChange}>
							<AlertDialogTrigger
								render={
									<Button className="h-8 w-full sm:w-auto" disabled={!canGive}>
										{isDistributing ? (
											<>
												<Loader2 className="animate-spin" />
												Giving...
											</>
										) : (
											<>
												<Share2 />
												Give contacts
											</>
										)}
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										{isDistributing
											? "Giving kept contacts"
											: "Confirm giving kept contacts"}
									</AlertDialogTitle>
									{isDistributing ? (
										<div className="space-y-4 pt-1 text-sm text-muted-foreground">
											<div className="flex items-center gap-2">
												<Loader2 className="size-4 animate-spin" />
												<span>{progressLabel}</span>
											</div>
											<Progress
												value={progress?.completed ?? 0}
												max={Math.max(progress?.total ?? 1, 1)}
											/>
										</div>
									) : (
										<AlertDialogDescription>
											Give {count} of your {heldContactCount} kept contact
											{heldContactCount === 1 ? "" : "s"} to{" "}
											{selectedAssignee?.name ??
												`the selected ${assigneeLabel.toLowerCase()}`}
											? {remainingAfterGive} will stay on your call list.
										</AlertDialogDescription>
									)}
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel disabled={isDistributing}>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={event => {
											event.preventDefault();
											void handleGive();
										}}
										disabled={isDistributing}>
										{isDistributing ? "Giving..." : "Confirm"}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
