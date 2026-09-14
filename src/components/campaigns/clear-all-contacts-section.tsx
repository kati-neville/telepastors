"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearAllContactsAction } from "@/app/actions/campaigns";
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
import { CLEAR_ALL_CONTACTS_CONFIRM_PHRASE } from "@/lib/validations/campaigns";

export function ClearAllContactsSection() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [open, setOpen] = useState(false);
	const [confirmPhrase, setConfirmPhrase] = useState("");

	const phraseMatches = confirmPhrase.trim() === CLEAR_ALL_CONTACTS_CONFIRM_PHRASE;

	const handleConfirm = () => {
		if (!phraseMatches) return;

		startTransition(async () => {
			const result = await clearAllContactsAction({
				confirmPhrase,
				confirm: true,
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			const deleted = result.data?.deletedContacts ?? 0;
			toast.success(
				deleted === 0
					? "No contacts to delete"
					: `Deleted ${deleted} contact${deleted === 1 ? "" : "s"}`,
			);
			setOpen(false);
			setConfirmPhrase("");
			router.refresh();
		});
	};

	return (
		<section className="rounded-xl border border-destructive/30 bg-card p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<h3 className="font-heading text-lg font-semibold text-destructive">
						Delete all contacts
					</h3>
					<p className="text-sm text-muted-foreground">
						Permanently removes every uploaded contact, assignment,
						distribution job, call history, and import record across all
						campaigns. Campaigns and telepastor accounts are kept. This cannot
						be undone.
					</p>
				</div>

				<AlertDialog
					open={open}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen);
						if (!nextOpen) {
							setConfirmPhrase("");
						}
					}}
				>
					<AlertDialogTrigger
						render={
							<Button variant="destructive" disabled={isPending}>
								<Trash2 />
								Delete all contacts
							</Button>
						}
					/>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete all contacts?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently deletes all uploaded and distributed contacts
								and their assignment/call history. Type{" "}
								<span className="font-medium text-foreground">
									{CLEAR_ALL_CONTACTS_CONFIRM_PHRASE}
								</span>{" "}
								to confirm.
							</AlertDialogDescription>
						</AlertDialogHeader>

						<div className="space-y-2">
							<Label htmlFor="clear-all-contacts-confirm">
								Confirmation phrase
							</Label>
							<Input
								id="clear-all-contacts-confirm"
								value={confirmPhrase}
								onChange={(event) => setConfirmPhrase(event.target.value)}
								placeholder={CLEAR_ALL_CONTACTS_CONFIRM_PHRASE}
								autoComplete="off"
								disabled={isPending}
							/>
						</div>

						<AlertDialogFooter>
							<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={handleConfirm}
								disabled={isPending || !phraseMatches}
							>
								{isPending ? (
									<>
										<Loader2 className="animate-spin" />
										Deleting...
									</>
								) : (
									"Delete all contacts"
								)}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</section>
	);
}
