
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
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

export default function EditorPage() {
  const { 
    selectedEvent, 
    logs, 
    upsertLog, 
    getLog, 
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
              Please select an event from the events page to view or add entries.
            </p>
            <Button asChild>
              <Link href="/events" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Go to Events
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppContainer>
    );
  }

  const handleSaveLog = (date: Date, log: Omit<DailyLog, 'eventId'>) => {
    upsertLog(date, log);
    toast({
      title: "Entry Updated!",
      description: `Your entry for ${format(date, "MMMM do, yyyy")} has been saved/updated.`,
      className: "bg-secondary text-secondary-foreground",
    });
  };

  const handleDeleteLog = (date: Date) => {
    const clearedLog: Omit<DailyLog, 'eventId'> = { 
      editorNotes: [], 
      songs: { editor: undefined, partner: undefined },
      partnerNotes: [], 
      promptForPartner: "", 
      promptForEditor: "",
      moods: { editor: null, partner: null } 
    };
    upsertLog(date, clearedLog); 
    toast({
      title: "Log Cleared!",
      description: `Your entry for ${format(date, "MMMM do, yyyy")} has been cleared.`,
      variant: "destructive",
    });
  };
  
  const currentLog = selectedDate ? getLog(selectedDate) : undefined;

  return (
    <AppContainer showHomeButton={true}>
      <PageSection title={`${selectedEvent.name} - Editor's Nook`} titleClassName="text-accent">
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
