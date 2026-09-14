"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateCampaignCallScriptAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CAMPAIGN_CALL_SCRIPT } from "@/lib/campaigns/call-script";

type CampaignCallScriptSectionProps = {
	campaignId: string;
	campaignName: string;
	callScript: string | null;
};

export function CampaignCallScriptSection({
	campaignId,
	campaignName,
	callScript,
}: CampaignCallScriptSectionProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(callScript ?? "");
	const [isPending, startTransition] = useTransition();

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraft(callScript?.trim() ? callScript : DEFAULT_CAMPAIGN_CALL_SCRIPT);
		}
		setOpen(nextOpen);
	};

	const handleSave = () => {
		startTransition(async () => {
			const result = await updateCampaignCallScriptAction(campaignId, {
				call_script: draft,
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success("Call script saved");
			setOpen(false);
			router.refresh();
		});
	};

	return (
		<section className="rounded-xl border bg-card p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<h3 className="font-heading text-lg font-semibold">Call script</h3>
					<p className="text-sm text-muted-foreground">
						Set the script callers see on the My Calls screen for{" "}
						{campaignName}.
					</p>
					{callScript?.trim() ? (
						<p className="line-clamp-3 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
							{callScript}
						</p>
					) : (
						<p className="text-sm text-muted-foreground">
							No script saved yet. Use the sample template to get started.
						</p>
					)}
				</div>

				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogTrigger
						render={<Button type="button" variant="outline" />}
					>
						<FileText />
						{callScript?.trim() ? "Edit script" : "Set script"}
					</DialogTrigger>
					<DialogContent className="sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>Campaign call script</DialogTitle>
							<DialogDescription>
								Callers can open this script while working through the queue.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="campaign-call-script">Script</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={isPending}
									onClick={() => setDraft(DEFAULT_CAMPAIGN_CALL_SCRIPT)}
								>
									Load sample template
								</Button>
							</div>
							<Textarea
								id="campaign-call-script"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								rows={16}
								className="min-h-64 font-mono text-sm"
								disabled={isPending}
							/>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={isPending}
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button type="button" disabled={isPending} onClick={handleSave}>
								{isPending ? (
									<>
										<Loader2 className="animate-spin" />
										Saving...
									</>
								) : (
									"Save script"
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</section>
	);
}
