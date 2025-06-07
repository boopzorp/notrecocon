"use client";

import { Progress } from "@/components/ui/progress";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Target } from "lucide-react";

interface InternshipProgressBarProps {
  startDateString: string | null;
  endDateString: string | null;
}

export function InternshipProgressBar({ startDateString, endDateString }: InternshipProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const startDate = startDateString ? parseISO(startDateString) : null;
  const endDate = endDateString ? parseISO(endDateString) : null;

  useEffect(() => {
    if (startDate && endDate && isValid(startDate) && isValid(endDate)) {
      const today = new Date();
      today.setHours(0,0,0,0); // Normalize today to start of day

      const totalDays = differenceInCalendarDays(endDate, startDate);
      let daysPassed = differenceInCalendarDays(today, startDate);
      
      // Clamp daysPassed between 0 and totalDays
      daysPassed = Math.max(0, Math.min(daysPassed, totalDays));

      if (totalDays > 0) {
        setProgress((daysPassed / totalDays) * 100);
      } else {
        // If start and end date are same or start is after end
        setProgress(today >= endDate ? 100 : 0);
      }
      
      const remaining = differenceInCalendarDays(endDate, today);
      setDaysRemaining(Math.max(0, remaining));

    } else {
      setProgress(0);
      setDaysRemaining(null);
    }
  }, [startDate, endDate]);

  if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary flex items-center">
            <Target className="w-6 h-6 mr-2"/>
            Our Countdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please set the internship dates in the Setup page to see the progress.</p>
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
           Our Countdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          From {formattedStartDate} to {formattedEndDate}
        </div>
        <Progress value={progress} className="w-full h-4" />
        <div className="text-center font-semibold text-accent">
          {daysRemaining !== null ? 
            (daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until you're back!` : "Welcome back soon!") :
            "Calculating..."}
        </div>
        {progress === 100 && <p className="text-center text-lg font-bold text-primary">The wait is over! 🎉</p>}
      </CardContent>
    </Card>
  );
}
