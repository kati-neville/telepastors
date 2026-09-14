"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTelepastorAction } from "@/app/actions/telepastors";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TelepastorDetail } from "@/types/domain";

export function DeleteTelepastorSection({
	telepastor,
}: {
	telepastor: TelepastorDetail;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);
	const [confirmName, setConfirmName] = useState("");

	const nameMatches =
		confirmName.trim().toLocaleLowerCase() ===
		telepastor.name.trim().toLocaleLowerCase();

	const handleConfirm = () => {
		if (!nameMatches) return;

		startTransition(async () => {
			const result = await deleteTelepastorAction(telepastor.id, {
				confirmName,
				confirm: true,
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success(`${telepastor.name} was permanently deleted`);
			setOpen(false);
			router.push("/telepastors");
			router.refresh();
		});
	};

	return (
		<section className="rounded-xl border border-destructive/30 bg-card p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<h3 className="font-heading text-lg font-semibold text-destructive">
						Delete permanently
					</h3>
					<p className="text-sm text-muted-foreground">
						Removes {telepastor.name}&apos;s account, sign-in access, and
						related assignment/call history. Telepastors under a leader are
						kept and become leaderless. Governors with members still assigned
						cannot be deleted until those members are reassigned. This cannot
						be undone.
					</p>
				</div>

				<AlertDialog
					open={open}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen);
						if (!nextOpen) {
							setConfirmName("");
						}
					}}
				>
					<AlertDialogTrigger
						render={
							<Button variant="destructive" disabled={isPending}>
								<Trash2 />
								Delete member
							</Button>
						}
					/>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete {telepastor.name}?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently deletes the ministry profile and login. Type{" "}
								<span className="font-medium text-foreground">
									{telepastor.name}
								</span>{" "}
								to confirm.
							</AlertDialogDescription>
						</AlertDialogHeader>

						<div className="space-y-2">
							<Label htmlFor="delete-telepastor-confirm-name">
								Member name
							</Label>
							<Input
								id="delete-telepastor-confirm-name"
								value={confirmName}
								onChange={(event) => setConfirmName(event.target.value)}
								placeholder={telepastor.name}
								autoComplete="off"
								disabled={isPending}
							/>
						</div>

						<AlertDialogFooter>
							<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={handleConfirm}
								disabled={isPending || !nameMatches}
							>
								{isPending ? (
									<>
										<Loader2 className="animate-spin" />
										Deleting...
									</>
								) : (
									"Delete permanently"
								)}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</section>
	);
}
