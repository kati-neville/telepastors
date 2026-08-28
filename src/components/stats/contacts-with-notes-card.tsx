import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

export function ContactsWithNotesCard({
	count,
	href,
}: {
	count: number;
	href: string;
}) {
	return (
		<Link
			href={href}
			className="group relative sm:col-span-1 col-span-2 overflow-hidden rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50 p-4 shadow-md ring-1 ring-amber-200/60 transition hover:border-amber-500 hover:shadow-lg dark:border-amber-600/50 dark:from-amber-950/50 dark:via-amber-950/30 dark:to-orange-950/20 dark:ring-amber-900/40">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
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
				<ArrowRight className="size-5 shrink-0 text-amber-600 transition group-hover:translate-x-0.5 dark:text-amber-400" />
			</div>
		</Link>
	);
}
