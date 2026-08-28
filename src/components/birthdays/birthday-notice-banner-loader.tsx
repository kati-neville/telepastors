import { BirthdayNoticeBanner } from "@/components/birthdays/birthday-notice-banner";
import { fetchBirthdayNotice } from "@/lib/queries/birthdays";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthorizationContext } from "@/lib/auth/permissions";

async function BirthdayNoticeBannerLoader({
  context,
}: {
  context: AuthorizationContext;
}) {
  const notice = await fetchBirthdayNotice(context);

  return <BirthdayNoticeBanner notice={notice} context={context} />;
}

export function BirthdayNoticeBannerFallback() {
  return <Skeleton className="mb-6 h-20 w-full rounded-xl" />;
}

export { BirthdayNoticeBannerLoader };
