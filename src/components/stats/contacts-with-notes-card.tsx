import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContactsWithNotesCard({
	count,
	href,
	className,
}: {
	count: number;
	href: string;
	className?: string;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"group block rounded-xl border border-amber-300/70 bg-amber-50 p-4 shadow-sm transition hover:border-amber-400 hover:bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/30 dark:hover:border-amber-700 dark:hover:bg-amber-950/40",
				className,
			)}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
							<MessageSquareText className="size-4" />
						</span>
						<p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
							Contacts with notes
						</p>
					</div>
					<p className="font-heading text-3xl font-bold tracking-tight text-amber-950 dark:text-amber-50">
						{count}
					</p>
					<p className="text-xs font-medium text-amber-800/80 dark:text-amber-200/80">
						Review notes and call directly
					</p>
				</div>
				<ArrowRight className="mt-1 size-5 shrink-0 text-amber-600 transition group-hover:translate-x-0.5 dark:text-amber-400" />
			</div>
		</Link>
	);
}
