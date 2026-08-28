"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateValue,
  isDateDisabled,
  parseDateValue,
} from "@/lib/dates/format";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
};

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  fromDate,
  toDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-start px-2.5 font-normal",
              !selectedDate && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon />
        {selectedDate ? format(selectedDate, "PPP") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? toDate ?? fromDate}
          captionLayout="dropdown"
          startMonth={fromDate}
          endMonth={toDate}
          onSelect={(date) => {
            onChange?.(date ? formatDateValue(date) : "");
            setOpen(false);
          }}
          disabled={(date) => isDateDisabled(date, { fromDate, toDate })}
        />
      </PopoverContent>
    </Popover>
  );
}
