
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { EventProgressBar } from '@/components/EventProgressBar';
import { AppCalendarView } from '@/components/AppCalendarView';
import { DailyDetailsCard } from '@/components/DailyDetailsCard';
import type { DailyLog } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Settings, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ReaderPage() {
  const { 
    selectedEvent, 
    logs, 
    getLog, 
    upsertLog, 
    isEventSelected, 
    isInitialized, 
    userRole,
    isLoadingLogs
  } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (isInitialized) {
      if (!userRole) {
        router.replace('/safe-space');
        return; 
      }
      if (!selectedEvent) {
        router.replace('/events');
        return;
      }
      // Initialize selectedDate based on selectedEvent
      if (selectedEvent && selectedEvent.startDate) {
        const start = parseISO(selectedEvent.startDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        let initialDate = start;
        if (selectedEvent.endDate) {
          const end = parseISO(selectedEvent.endDate);
          if (today >= start && today <= end) {
            initialDate = today;
          }
        }
        setSelectedDate(initialDate);
      }
    }
  }, [isInitialized, userRole, selectedEvent, router]);

  useEffect(() => {
    // Adjust selectedDate if it falls outside the selectedEvent's range
    if (selectedEvent && selectedEvent.startDate && selectedEvent.endDate && selectedDate) {
      const start = parseISO(selectedEvent.startDate);
      const end = parseISO(selectedEvent.endDate);
      if (selectedDate < start || selectedDate > end) {
        setSelectedDate(start);
      }
    }
  }, [selectedEvent, selectedDate]);


  if (!isInitialized || !userRole || isLoadingLogs) { 
    return (
      <AppContainer showHomeButton={true}>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Loading application data...</p>
        </div>
      </AppContainer>
    );
  }

  if (!isEventSelected() || !selectedEvent) {
     return (
      <AppContainer showHomeButton={true}>
        <Card className="my-8 text-center">
          <CardContent className="p-6 space-y-4">
            <Briefcase className="w-12 h-12 mx-auto text-primary" />
            <h3 className="text-2xl font-semibold text-primary">No Event Selected</h3>
            <p className="text-muted-foreground">
             Please select an event from the events page to view entries.
            </p>
             <Button asChild variant="outline">
              <Link href="/events" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4"/> Go to Events
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppContainer>
    );
  }
  
  const currentLog = selectedDate ? getLog(selectedDate) : undefined;

  const handleSavePartnerNote = (date: Date, logWithPartnerNotes: Omit<DailyLog, 'eventId'>) => {
    upsertLog(date, logWithPartnerNotes);
    toast({
      title: "New Note Added!",
      description: `Your special note for ${format(date, "MMMM do, yyyy")} has been saved.`,
      className: "bg-secondary text-secondary-foreground",
    });
  };

  return (
    <AppContainer showHomeButton={true}>
      <PageSection title={`${selectedEvent.name} - Reader's Haven`} titleClassName="text-accent">
        <EventProgressBar 
            eventName={selectedEvent.name} 
            eventStartDateString={selectedEvent.startDate} 
            eventEndDateString={selectedEvent.endDate} 
        />
      </PageSection>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <PageSection title="Event Calendar" titleClassName="text-primary">
          <AppCalendarView
            eventStartDateString={selectedEvent.startDate}
            eventEndDateString={selectedEvent.endDate}
            logs={logs}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            mode="reader"
          />
        </PageSection>
        
        <PageSection title="Daily Message & Your Notes" titleClassName="text-primary">
          {selectedDate ? (
            <DailyDetailsCard
              selectedDate={selectedDate}
              log={currentLog}
              onSave={handleSavePartnerNote} 
              mode="reader"
            />
          ) : (
             <Card className="shadow-md">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Select a date from the calendar to view entries or add your notes.</p>
              </CardContent>
            </Card>
          )}
        </PageSection>
      </div>
    </AppContainer>
  );
}
