"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { InternshipProgressBar } from '@/components/InternshipProgressBar';
import { AppCalendarView } from '@/components/AppCalendarView';
import { DailyDetailsCard } from '@/components/DailyDetailsCard';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { parseISO } from 'date-fns';

export default function ReaderPage() {
  const { internshipStart, internshipEnd, logs, getLog, isConfigured, isInitialized } = useAppContext();
  const router = useRouter();

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
    if (isInitialized && !isConfigured()) {
      // For reader, if not configured, perhaps show a message rather than redirecting to setup
      // Or redirect to a "waiting" page. For now, the components handle lack of config.
    }
  }, [isInitialized, isConfigured, router]);

  // Adjust selectedDate if internship dates change and selectedDate is outside new range
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
              onSave={() => {}} // No-op for reader
              mode="reader"
            />
          ) : (
             <Card className="shadow-md">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Select a date from the calendar to view the entry for that day.</p>
              </CardContent>
            </Card>
          )}
        </PageSection>
      </div>
    </AppContainer>
  );
}
