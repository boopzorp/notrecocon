
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { InternshipProgressBar } from '@/components/InternshipProgressBar';
import { AppCalendarView } from '@/components/AppCalendarView';
import { DailyDetailsCard } from '@/components/DailyDetailsCard';
import type { DailyLog } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

export default function EditorPage() {
  const { internshipStart, internshipEnd, logs, upsertLog, getLog, isConfigured, isInitialized, userRole } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (internshipStart) {
      const start = parseISO(internshipStart);
      // Default to today if within range, else start date
      const today = new Date();
      today.setHours(0,0,0,0);
      if (internshipEnd) {
        const end = parseISO(internshipEnd);
        if (today >= start && today <= end) return today;
      }
      return start;
    }
    return undefined;
  });

  useEffect(() => {
    if (isInitialized) {
      if (!userRole) {
        router.replace('/safe-space');
        return; // Exit early to prevent further checks if redirecting
      }
      if (!isConfigured()) {
        router.replace('/setup');
      }
    }
  }, [isInitialized, userRole, isConfigured, router]);
  
  useEffect(() => {
    if (internshipStart && internshipEnd && selectedDate) {
      const start = parseISO(internshipStart);
      const end = parseISO(internshipEnd);
      if (selectedDate < start || selectedDate > end) {
        setSelectedDate(start); 
      }
    } else if (internshipStart && !selectedDate) {
      const start = parseISO(internshipStart);
      const today = new Date();
      today.setHours(0,0,0,0);
       if (internshipEnd) {
        const end = parseISO(internshipEnd);
        if (today >= start && today <= end) {
          setSelectedDate(today);
          return;
        }
      }
      setSelectedDate(start);
    }
  }, [internshipStart, internshipEnd, selectedDate]);


  if (!isInitialized || !userRole) { // Added !userRole check here too for loading state
    return (
      <AppContainer showHomeButton={true}>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Loading application data...</p>
        </div>
      </AppContainer>
    );
  }
  
  // isConfigured check for UI message is still relevant if userRole IS set but dates are not.
  // The useEffect above handles the redirect if !isConfigured().
  if (!isConfigured()) {
     return (
      <AppContainer showHomeButton={true}>
        <Card className="my-8 text-center">
          <CardContent className="p-6 space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h3 className="text-2xl font-semibold text-destructive">Configuration Needed</h3>
            <p className="text-muted-foreground">
              Please set the internship start and end dates to use the editor.
            </p>
            <Button asChild>
              <Link href="/setup" className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Go to Setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppContainer>
    );
  }

  const handleSaveLog = (date: Date, log: DailyLog) => {
    upsertLog(date, log);
    toast({
      title: "Entry Updated!",
      description: `Your entry for ${format(date, "MMMM do, yyyy")} has been saved/updated.`,
      className: "bg-secondary text-secondary-foreground",
    });
  };

  const handleDeleteLog = (date: Date) => {
    upsertLog(date, { editorNotes: [], spotifyLink: "", songTitle: "", partnerNotes: [] }); // Clear all parts of the log
    toast({
      title: "Log Deleted!",
      description: `Your entry for ${format(date, "MMMM do, yyyy")} has been cleared.`,
      variant: "destructive",
    });
  };
  
  const currentLog = selectedDate ? getLog(selectedDate) : undefined;

  return (
    <AppContainer showHomeButton={true}>
      <PageSection title="Editor's Nook" titleClassName="text-accent">
        <InternshipProgressBar startDateString={internshipStart} endDateString={internshipEnd} />
      </PageSection>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <PageSection title="Our Calendar" titleClassName="text-primary">
          <AppCalendarView
            startDateString={internshipStart}
            endDateString={internshipEnd}
            logs={logs}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            mode="editor"
          />
        </PageSection>
        
        <PageSection title="Daily Entry" titleClassName="text-primary">
          {selectedDate ? (
            <DailyDetailsCard
              selectedDate={selectedDate}
              log={currentLog}
              onSave={handleSaveLog}
              onDelete={handleDeleteLog}
              mode="editor"
            />
          ) : (
            <Card className="shadow-md">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Select a date from the calendar to add or edit an entry.</p>
              </CardContent>
            </Card>
          )}
        </PageSection>
      </div>
    </AppContainer>
  );
}
