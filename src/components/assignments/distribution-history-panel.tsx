"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
	listCampaignAssigneeUndoRowsAction,
	previewUndoAssigneeAction,
	undoAssigneeAssignmentsAction,
} from "@/app/actions/assignments";
import type { CampaignAssigneeUndoRow } from "@/lib/assignments/assignee-undo";
import type { UndoAssigneePreviewCounts } from "@/lib/assignments/called-contacts";
import { formatUndoAssigneeSummary } from "@/lib/assignments/undo-distribution";
import { getRoleLabel } from "@/lib/auth/roles";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

function UndoAssigneeDialog({
	campaignId,
	assigneeId,
	assigneeName,
	assigneeLabel,
	disabled,
	isUndoing,
	onConfirm,
}: {
	campaignId: string;
	assigneeId: string;
	assigneeName: string;
	assigneeLabel: string;
	disabled: boolean;
	isUndoing: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<UndoAssigneePreviewCounts | null>(
		null,
	);

	const handleOpenChange = (nextOpen: boolean) => {
		if (isUndoing) {
			return;
		}

		setOpen(nextOpen);

		if (!nextOpen) {
			return;
		}

		setLoading(true);
		setError(null);
		setPreview(null);

		void previewUndoAssigneeAction(campaignId, assigneeId).then(result => {
			if (!result.success) {
				setError(result.error);
				setLoading(false);
				return;
			}

			setPreview(result.data ?? null);
			setLoading(false);
		});
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogTrigger
				render={
					<Button type="button" variant="outline" size="sm" disabled={disabled}>
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
						Return uncalled contacts from {assigneeName}?
					</AlertDialogTitle>
					{loading ? (
						<AlertDialogDescription className="flex items-center gap-2">
							<Loader2 className="size-4 animate-spin" />
							Checking call attempts…
						</AlertDialogDescription>
					) : error ? (
						<AlertDialogDescription>{error}</AlertDialogDescription>
					) : preview ? (
						<div className="space-y-3">
							<dl className="grid gap-2 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
								<div className="flex items-center justify-between gap-4">
									<dt className="text-muted-foreground">
										With attempts or saved responses
									</dt>
									<dd className="tabular-nums font-medium">
										{preview.withAttemptsCount}
									</dd>
								</div>
								<div className="flex items-center justify-between gap-4">
									<dt className="text-muted-foreground">No attempts</dt>
									<dd className="tabular-nums font-medium">
										{preview.noAttemptsCount}
									</dd>
								</div>
							</dl>
							<AlertDialogDescription>
								{preview.noAttemptsCount > 0
									? `Undo returns ${preview.noAttemptsCount} uncalled contact${preview.noAttemptsCount === 1 ? "" : "s"} to your pool.`
									: "There are no uncalled contacts left to return."}{" "}
								{preview.withAttemptsCount > 0
									? `${preview.withAttemptsCount} with attempts or saved responses stay with ${assigneeName}.`
									: null}{" "}
								Other {assigneeLabel.toLowerCase()}s are not affected.
							</AlertDialogDescription>
						</div>
					) : (
						<AlertDialogDescription>
							Only uncalled contacts will return to your pool.
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isUndoing}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={
							isUndoing ||
							loading ||
							Boolean(error) ||
							!preview ||
							preview.noAttemptsCount === 0
						}
						onClick={event => {
							event.preventDefault();
							setOpen(false);
							onConfirm();
						}}>
						Confirm undo
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

type DistributionHistoryPanelProps = {
	campaignId: string;
	assigneeLabel: string;
	refreshKey?: number | string;
};

export function DistributionHistoryPanel({
	campaignId,
	assigneeLabel,
	refreshKey = 0,
}: DistributionHistoryPanelProps) {
	const router = useRouter();
	const [rows, setRows] = useState<CampaignAssigneeUndoRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [isPending, startTransition] = useTransition();
	const [undoingId, setUndoingId] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		setLoading(true);
		void listCampaignAssigneeUndoRowsAction(campaignId).then(result => {
			if (cancelled) return;
			if (!result.success) {
				setRows([]);
				setLoading(false);
				return;
			}
			setRows(result.data ?? []);
			setLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [campaignId, refreshKey]);

	const filteredRows = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return rows;
		}

		return rows.filter(
			row =>
				row.name.toLowerCase().includes(query) ||
				getRoleLabel(row.role).toLowerCase().includes(query),
		);
	}, [rows, search]);

	const handleUndo = (assigneeId: string, assigneeName: string) => {
		setUndoingId(assigneeId);
		startTransition(async () => {
			const result = await undoAssigneeAssignmentsAction(
				campaignId,
				assigneeId,
			);

			if (!result.success) {
				toast.error(result.error);
				setUndoingId(null);
				return;
			}

			const summary = formatUndoAssigneeSummary({
				reclaimedCount: result.data?.reclaimedCount ?? 0,
				keptCalledCount: result.data?.keptCalledCount ?? 0,
				otherBlockedCount: result.data?.otherBlockedCount ?? 0,
			});

			toast.success(`Undo for ${assigneeName}: ${summary}.`);
			setUndoingId(null);
			router.refresh();
			void listCampaignAssigneeUndoRowsAction(campaignId).then(reload => {
				if (reload.success) {
					setRows(reload.data ?? []);
				}
			});
		});
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading assigned {assigneeLabel.toLowerCase()}s…
				</CardContent>
			</Card>
		);
	}

	if (rows.length === 0) {
		return null;
	}

	return (
		<Card className="min-w-0">
			<CardHeader className="pb-3">
				<CardTitle className="text-base">
					Assigned {assigneeLabel.toLowerCase()}s
				</CardTitle>
				<CardDescription>
					Undo returns uncalled contacts from one person to your pool. Contacts
					with attempts stay with them.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="assignee-undo-search">
						Search {assigneeLabel.toLowerCase()}s
					</Label>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="assignee-undo-search"
							value={search}
							onChange={event => setSearch(event.target.value)}
							placeholder={`Search by name or role`}
							className="pl-9"
						/>
					</div>
				</div>

				{filteredRows.length === 0 ? (
					<div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
						No {assigneeLabel.toLowerCase()}s match your search.
					</div>
				) : (
					<>
						<div className="grid gap-3 md:hidden">
							{filteredRows.map(row => {
								const canUndo = row.unattemptedCount > 0;
								const isUndoing = undoingId === row.assigneeId && isPending;

								return (
									<div
										key={row.assigneeId}
										className="space-y-3 rounded-xl border p-4">
										<div>
											<p className="font-medium">{row.name}</p>
											<p className="text-xs text-muted-foreground">
												{getRoleLabel(row.role)}
											</p>
										</div>
										<dl className="grid grid-cols-3 gap-2 text-center text-sm">
											<div>
												<dt className="text-xs text-muted-foreground">
													Assigned
												</dt>
												<dd className="tabular-nums font-medium">
													{row.assignedCount}
												</dd>
											</div>
											<div>
												<dt className="text-xs text-muted-foreground">
													Attempted
												</dt>
												<dd className="tabular-nums font-medium">
													{row.attemptedCount}
												</dd>
											</div>
											<div>
												<dt className="text-xs text-muted-foreground">
													Not attempted
												</dt>
												<dd className="tabular-nums font-medium">
													{row.unattemptedCount}
												</dd>
											</div>
										</dl>
										{canUndo ? (
											<UndoAssigneeDialog
												campaignId={campaignId}
												assigneeId={row.assigneeId}
												assigneeName={row.name}
												assigneeLabel={assigneeLabel}
												disabled={isPending}
												isUndoing={isUndoing}
												onConfirm={() => handleUndo(row.assigneeId, row.name)}
											/>
										) : (
											<p className="text-xs text-muted-foreground">
												No uncalled contacts to return
											</p>
										)}
									</div>
								);
							})}
						</div>

						<div className="hidden overflow-hidden rounded-xl border md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{assigneeLabel}</TableHead>
										<TableHead className="text-right">Assigned</TableHead>
										<TableHead className="text-right">Attempted</TableHead>
										<TableHead className="text-right">Not attempted</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredRows.map(row => {
										const canUndo = row.unattemptedCount > 0;
										const isUndoing =
											undoingId === row.assigneeId && isPending;

										return (
											<TableRow key={row.assigneeId}>
												<TableCell>
													<p className="font-medium">{row.name}</p>
													<p className="text-xs text-muted-foreground">
														{getRoleLabel(row.role)}
													</p>
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{row.assignedCount}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{row.attemptedCount}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{row.unattemptedCount}
												</TableCell>
												<TableCell className="text-right">
													{canUndo ? (
														<UndoAssigneeDialog
															campaignId={campaignId}
															assigneeId={row.assigneeId}
															assigneeName={row.name}
															assigneeLabel={assigneeLabel}
															disabled={isPending}
															isUndoing={isUndoing}
															onConfirm={() =>
																handleUndo(row.assigneeId, row.name)
															}
														/>
													) : (
														<span className="text-xs text-muted-foreground">
															—
														</span>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
