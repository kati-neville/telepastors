"use client";

import { Button } from "@/components/ui/button";

export type DistributionMode = "equal" | "manual";

const MODE_OPTIONS: { value: DistributionMode; label: string }[] = [
  { value: "equal", label: "Equal split" },
  { value: "manual", label: "Manual assign" },
];

type DistributionModeTabsProps = {
  mode: DistributionMode;
  onModeChange: (mode: DistributionMode) => void;
};

export function DistributionModeTabs({
  mode,
  onModeChange,
}: DistributionModeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={mode === option.value ? "default" : "outline"}
          onClick={() => onModeChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
