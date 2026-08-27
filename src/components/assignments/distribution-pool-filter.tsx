"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DistributionFilterValues } from "@/lib/validations/assignments";

const SUPER_ADMIN_POOL_OPTIONS: {
  value: DistributionFilterValues["pool"];
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
];

export function DistributionPoolFilter({
  currentPool,
  showFilters,
}: {
  currentPool: DistributionFilterValues["pool"];
  showFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!showFilters) {
    return null;
  }

  const setPool = (pool: DistributionFilterValues["pool"]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (pool === "all") {
      params.delete("pool");
    } else {
      params.set("pool", pool);
    }

    router.replace(params.toString() ? `${pathname}?${params}` : pathname);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {SUPER_ADMIN_POOL_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={currentPool === option.value ? "default" : "outline"}
          onClick={() => setPool(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
