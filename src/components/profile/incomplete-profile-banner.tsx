import Link from "next/link";
import {
  formatMissingProfileFields,
  type ProfileField,
} from "@/lib/profile/completeness";
import { cn } from "@/lib/utils";

type IncompleteProfileBannerProps = {
  missingFields: ProfileField[];
  href?: string;
};

const bannerClassName =
  "rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100";

export function IncompleteProfileBanner({
  missingFields,
  href,
}: IncompleteProfileBannerProps) {
  if (missingFields.length === 0) {
    return null;
  }

  const message = (
    <>
      Complete your profile by adding your{" "}
      {formatMissingProfileFields(missingFields)}.
    </>
  );

  if (!href) {
    return <div className={bannerClassName}>{message}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        bannerClassName,
        "block transition-colors hover:bg-amber-500/10",
      )}
    >
      {message}{" "}
      <span className="font-medium underline underline-offset-2">
        Update profile
      </span>
    </Link>
  );
}
