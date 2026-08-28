"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContactsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function buildPageHref(
  pathname: string,
  searchParams: URLSearchParams,
  page: number,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));
  return `${pathname}?${params.toString()}`;
}

export function ContactsPagination({
  page,
  pageSize,
  total,
  totalPages,
}: ContactsPaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (total === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of{" "}
        {total.toLocaleString()} contacts
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          render={
            <Link
              href={buildPageHref(pathname, searchParams, previousPage)}
              aria-disabled={page <= 1}
            />
          }
        >
          <ChevronLeft />
          Previous
        </Button>
        <span className="min-w-24 text-center text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          render={
            <Link
              href={buildPageHref(pathname, searchParams, nextPage)}
              aria-disabled={page >= totalPages}
            />
          }
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
