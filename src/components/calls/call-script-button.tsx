"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

type CallScriptButtonProps = {
	campaignName: string;
	script: string;
};

export function CallScriptButton({
	campaignName,
	script,
}: CallScriptButtonProps) {
	const [open, setOpen] = useState(false);

	if (!script.trim()) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button type="button" variant="outline" className="w-full min-h-12" />
				}
			>
				<ScrollText />
				View call script
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Call script</DialogTitle>
					<DialogDescription>{campaignName}</DialogDescription>
				</DialogHeader>
				<div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-md border bg-muted/30 p-4">
					<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
						{script}
					</pre>
				</div>
			</DialogContent>
		</Dialog>
	);
}
