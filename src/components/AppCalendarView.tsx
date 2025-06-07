"use client";

import { Calendar } from "@/components/ui/calendar";
import type { DailyLog } from "@/lib/types";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { DateFormatter, DayModifiers } from "react-day-picker";

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
        day_today: "bg-accent text-accent-foreground",
        head_cell: "text-muted-foreground rounded-md w-10 font-normal text-base",
        caption_label: "text-xl font-headline text-primary",
      }}
      showOutsideDays={false} // Don't show days outside of the current month if they are also outside internship period
    />
  );
}
