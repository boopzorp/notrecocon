
"use client";

import { Progress } from "@/components/ui/progress";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Target } from "lucide-react";

interface EventProgressBarProps {
  eventName: string | null;
  eventStartDateString: string | null;
  eventEndDateString: string | null;
}

export function EventProgressBar({ eventName, eventStartDateString, eventEndDateString }: EventProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const startDate = eventStartDateString ? parseISO(eventStartDateString) : null;
  const endDate = eventEndDateString ? parseISO(eventEndDateString) : null;

  useEffect(() => {
    if (startDate && endDate && isValid(startDate) && isValid(endDate)) {
      const today = new Date();
      today.setHours(0,0,0,0); 

      const totalDays = differenceInCalendarDays(endDate, startDate);
      let daysPassed = differenceInCalendarDays(today, startDate);
      
      daysPassed = Math.max(0, Math.min(daysPassed, totalDays));

      if (totalDays > 0) {
        setProgress((daysPassed / totalDays) * 100);
      } else {
        setProgress(today >= endDate ? 100 : 0);
      }
      
      const remaining = differenceInCalendarDays(endDate, today);
      setDaysRemaining(Math.max(0, remaining));

    } else {
      setProgress(0);
      setDaysRemaining(null);
    }
  }, [startDate, endDate]);

  const progressBarTitle = eventName ? `Countdown for: ${eventName}` : "Our Countdown";

  if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary flex items-center">
            <Target className="w-6 h-6 mr-2"/>
            {progressBarTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please set the event name and dates in the Setup page to see the progress.</p>
        </CardContent>
      </Card>
    );
  }
  
  const formattedStartDate = format(startDate, "MMMM do, yyyy");
  const formattedEndDate = format(endDate, "MMMM do, yyyy");

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-primary flex items-center">
           <Target className="w-6 h-6 mr-2"/>
           {progressBarTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          From {formattedStartDate} to {formattedEndDate}
        </div>
        <Progress value={progress} className="w-full h-4" />
        <div className="text-center font-semibold text-accent">
          {daysRemaining !== null ? 
            (daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until it's here!` : "The day is here!") :
            "Calculating..."}
        </div>
        {progress === 100 && <p className="text-center text-lg font-bold text-primary">The event has concluded or is today! 🎉</p>}
      </CardContent>
    </Card>
  );
}
