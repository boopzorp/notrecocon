
"use client";

import { Calendar } from "@/components/ui/calendar";
import type { DailyLog } from "@/lib/types";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { DateFormatter, DayModifiers } from "react-day-picker";
import { cn } from "@/lib/utils";

interface AppCalendarViewProps {
  startDateString: string | null;
  endDateString: string | null;
  logs: Record<string, DailyLog>;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  mode: 'editor' | 'reader';
}

export function AppCalendarView({
  startDateString,
  endDateString,
  logs,
  selectedDate,
  onSelectDate,
  mode
}: AppCalendarViewProps) {

  const startDate = startDateString ? parseISO(startDateString) : null;
  const endDate = endDateString ? parseISO(endDateString) : null;

  if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
    return <p className="text-muted-foreground text-center py-4">Calendar will appear once internship dates are set.</p>;
  }

  const formatDay: DateFormatter = (day) => format(day, "d");

  const modifiers: DayModifiers = {
    disabled: [
      { before: startDate },
      { after: endDate }
    ],
    hasLog: Object.keys(logs).map(dateStr => parseISO(dateStr)),
    today: new Date(),
    selected: selectedDate ? selectedDate : new Date(0), // Ensure selected is always a Date
  };

  const modifiersClassNames = {
    hasLog: 'bg-accent/30 rounded-full font-bold',
    today: 'border-2 border-primary rounded-full',
    selected: 'bg-primary text-primary-foreground rounded-full',
  };

  // Ensure calendar shows the month of the start date, or selected date if available
  const initialMonth = selectedDate || startDate;

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelectDate}
      fromDate={startDate}
      toDate={endDate}
      month={initialMonth}
      formatters={{ formatDay }}
      modifiers={modifiers}
      modifiersClassNames={modifiersClassNames}
      className="rounded-md border shadow-md bg-card p-4 w-full"
      classNames={{
        day: "h-10 w-10 text-base rounded-full",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground", // This will be overridden by modifiersClassNames.today if date is also selected
        head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-base text-center",
        caption_label: "text-xl font-headline text-primary",
        cell: cn(
          "h-10 text-center text-sm p-0 relative flex-1", // Ensure cell size matches day size and is flexible
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-outside)]:bg-accent/50", // Style for selected days outside current month
          "[&:has([aria-selected]:not(.day-outside))]:bg-transparent", // Make cell transparent for selected in-month days
          // Range selection related, keep for completeness though not primary for "single" mode
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md"
        ),
      }}
      showOutsideDays={false} // Don't show days outside of the current month if they are also outside internship period
    />
  );
}

