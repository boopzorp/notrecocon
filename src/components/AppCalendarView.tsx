
"use client";

import { Calendar } from "@/components/ui/calendar";
import type { DailyLog } from "@/lib/types";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { DateFormatter, DayModifiers } from "react-day-picker";
import { cn } from "@/lib/utils";

interface AppCalendarViewProps {
  eventStartDateString: string | null;
  eventEndDateString: string | null;
  isEvergreen?: boolean;
  logs: Record<string, DailyLog>;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  mode: 'editor' | 'reader';
}

export function AppCalendarView({
  eventStartDateString,
  eventEndDateString,
  isEvergreen,
  logs,
  selectedDate,
  onSelectDate,
  mode
}: AppCalendarViewProps) {

  const startDate = !isEvergreen && eventStartDateString ? parseISO(eventStartDateString) : null;
  const endDate = !isEvergreen && eventEndDateString ? parseISO(eventEndDateString) : null;

  if (!isEvergreen && (!startDate || !endDate || !isValid(startDate) || !isValid(endDate))) {
    return <p className="text-muted-foreground text-center py-4">Calendar will appear once event dates are set.</p>;
  }

  const formatDay: DateFormatter = (day) => format(day, "d");

  const dayModifiers: DayModifiers = {
    hasLog: Object.keys(logs).map(dateStr => parseISO(dateStr)),
    today: new Date(),
    selected: selectedDate ? selectedDate : new Date(0), 
  };

  if (!isEvergreen && startDate && endDate) {
    dayModifiers.disabled = [
      { before: startDate },
      { after: endDate }
    ];
  }


  const modifiersClassNames = {
    hasLog: 'bg-accent/30 rounded-full font-bold',
    today: 'border-2 border-primary rounded-full',
    selected: 'bg-primary text-primary-foreground rounded-full',
  };

  const initialMonth = selectedDate || (startDate || new Date());

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelectDate}
      fromDate={startDate || undefined} // Pass undefined if null
      toDate={endDate || undefined}   // Pass undefined if null
      month={initialMonth}
      formatters={{ formatDay }}
      modifiers={dayModifiers}
      modifiersClassNames={modifiersClassNames}
      className="rounded-md border shadow-md bg-card p-4 w-full"
      classNames={{
        day: "h-10 w-10 text-base rounded-full",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground", 
        head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-base text-center",
        caption_label: "text-xl font-headline text-primary",
        cell: cn(
          "h-10 text-center text-sm p-0 relative flex-1", 
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-outside)]:bg-accent/50", 
          "[&:has([aria-selected]:not(.day-outside))]:bg-transparent", 
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md"
        ),
      }}
      showOutsideDays={isEvergreen ? true : false} // Show outside days for evergreen for easier navigation
    />
  );
}

    