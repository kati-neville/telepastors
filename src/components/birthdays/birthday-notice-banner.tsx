import Link from "next/link";
import { Cake } from "lucide-react";
import { formatBirthdayNames } from "@/lib/birthdays/view";
import { canAccessBirthdays } from "@/lib/auth/permissions";
import type { AuthorizationContext } from "@/lib/auth/permissions";
import type { BirthdayNotice } from "@/types/domain";

type BirthdayNoticeBannerProps = {
	notice: BirthdayNotice;
	context: AuthorizationContext;
};

export function BirthdayNoticeBanner({
	notice,
	context,
}: BirthdayNoticeBannerProps) {
	const teamBirthdays = notice.todaysBirthdays.filter(
		entry => entry.id !== context.telepastor.id,
	);
	const hasTeamBirthdays = teamBirthdays.length > 0;
	const canOpenBirthdaysPage = canAccessBirthdays(context);

	if (!notice.viewerBirthdayToday && !hasTeamBirthdays) {
		return null;
	}

	return (
		<div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-4 py-3 shadow-sm">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
					<Cake className="size-4" />
				</div>
				<div className="min-w-0 flex-1 space-y-1">
					{notice.viewerBirthdayToday ? (
						<p className="font-medium text-amber-950 dark:text-amber-50">
							Happy birthday, {notice.viewerName}! 🎉
						</p>
					) : null}

					{hasTeamBirthdays ? (
						<p className="text-sm text-amber-900/90 dark:text-amber-100/90">
							{notice.viewerBirthdayToday
								? "You're celebrating with "
								: "Happy birthday to "}
							{formatBirthdayNames(teamBirthdays.map(entry => entry.name))}
							{notice.viewerBirthdayToday ? " today." : " today."} 🎉
						</p>
					) : notice.viewerBirthdayToday ? (
						<p className="text-sm text-amber-900/90 dark:text-amber-100/90">
							Wishing you a blessed day from the Telepastors Ministry.
						</p>
					) : null}

					{canOpenBirthdaysPage && hasTeamBirthdays ? (
						<Link
							href={`/birthdays?period=month&month=${new Date().getMonth() + 1}`}
							className="inline-flex text-sm font-medium text-amber-800 underline-offset-4 hover:underline dark:text-amber-200">
							View today&apos;s birthdays
						</Link>
					) : null}
				</div>
			</div>
		</div>
	);
}
