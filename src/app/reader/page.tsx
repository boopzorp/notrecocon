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
import { parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ReaderPage() {
  const { internshipStart, internshipEnd, logs, getLog, upsertLog, isConfigured, isInitialized } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (internshipStart) {
      const start = parseISO(internshipStart);
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
    if (isInitialized && !isConfigured()) {
      // Message handled by component
    }
  }, [isInitialized, isConfigured, router]);

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

  if (!isInitialized) {
    return (
      <AppContainer showHomeButton={true}>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Loading application data...</p>
        </div>
      </AppContainer>
    );
  }

  if (!isConfigured()) {
     return (
      <AppContainer showHomeButton={true}>
        <Card className="my-8 text-center">
          <CardContent className="p-6 space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-primary" />
            <h3 className="text-2xl font-semibold text-primary">Waiting for Setup</h3>
            <p className="text-muted-foreground">
              The app isn't quite ready yet. Please ask the editor to configure the internship dates.
            </p>
             <Button asChild variant="outline">
              <Link href="/" className="flex items-center gap-2">
                Go Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppContainer>
    );
  }
  
  const currentLog = selectedDate ? getLog(selectedDate) : undefined;

  const handleSavePartnerNote = (date: Date, logWithPartnerNote: DailyLog) => {
    upsertLog(date, logWithPartnerNote);
    toast({
      title: "Note Saved!",
      description: `Your special note for ${format(date, "MMMM do, yyyy")} has been saved.`,
      className: "bg-secondary text-secondary-foreground",
    });
  };

  return (
    <AppContainer showHomeButton={true}>
      <PageSection title="Reader's Haven" titleClassName="text-accent">
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
            mode="reader"
          />
        </PageSection>
        
        <PageSection title="Daily Message" titleClassName="text-primary">
          {selectedDate ? (
            <DailyDetailsCard
              selectedDate={selectedDate}
              log={currentLog}
              onSave={handleSavePartnerNote} // Partner saves their note
              mode="reader"
            />
          ) : (
             <Card className="shadow-md">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Select a date from the calendar to view the entry or leave a note for that day.</p>
              </CardContent>
            </Card>
          )}
        </PageSection>
      </div>
    </AppContainer>
  );
}
