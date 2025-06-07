
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarDays, ChevronRight, PlusCircle, Trash2, AlertTriangle, Info, LogOut, Activity } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Event } from '@/lib/types';

function EventStatus({ event }: { event: Event }) {
  if (event.isEvergreen) {
    return <span className="text-sm font-semibold text-primary flex items-center"><Activity className="w-4 h-4 mr-1"/> Always Active</span>;
  }
  if (!event.startDate || !event.endDate) return null; // Should not happen for non-evergreen

  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isPast(endDate) && !isToday(endDate)) {
    return <span className="text-sm font-semibold text-destructive">Ended</span>;
  }

  const daysRemaining = differenceInCalendarDays(endDate, today);

  if (daysRemaining < 0) { 
     return <span className="text-sm font-semibold text-destructive">Ended</span>;
  }
  if (daysRemaining === 0) {
    return <span className="text-sm font-semibold text-accent">Happening Today!</span>;
  }
  return <span className="text-sm font-semibold text-primary">{`${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}</span>;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}


export default function EventsPage() {
  const { events, userRole, selectEvent, setUserRole, isLoadingEvents, isInitialized, resetAllAppData } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  useEffect(() => {
    if (isInitialized && !userRole) {
      router.replace('/safe-space');
    }
  }, [isInitialized, userRole, router]);

  if (!isInitialized || isLoadingEvents) {
    return (
      <AppContainer>
        <PageSection title="Our Events">
          <div className="flex justify-center items-center h-64">
            <p className="text-xl text-muted-foreground">Loading events...</p>
          </div>
        </PageSection>
      </AppContainer>
    );
  }

  const handleSelectEvent = (eventId: string) => {
    selectEvent(eventId);
    router.push('/');
  };

  const handleResetData = async () => {
    await resetAllAppData();
    toast({
      title: "Application Reset",
      description: "All non-evergreen events and daily logs have been cleared. 'Daily Life' event remains.",
      variant: "destructive"
    });
    setIsResetDialogOpen(false); 
  };

  const handleLogout = () => {
    setUserRole(null); 
    selectEvent(null); 
    router.push('/safe-space'); 
    toast({
      title: "Logged Out",
      description: "You have successfully left Our Safe Space.",
    });
  };

  const isEditor = userRole === 'editor';

  return (
    <AppContainer showHomeButton={false}>
      <PageSection title="Our Special Events" titleClassName="text-accent">
        <CardDescription className="mb-6">
          {isEditor 
            ? "Manage your shared events here. Select an event to view or edit its entries, or create a new one."
            : "Here are our special events. Select one to view the entries."}
        </CardDescription>

        {isEditor && (
          <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg">
              <Link href="/setup-event" className="flex items-center">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Event
              </Link>
            </Button>
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg" className="flex items-center">
                  <Trash2 className="mr-2 h-5 w-5" /> Reset All App Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete ALL non-evergreen events and ALL daily log entries from the application. The 'Daily Life' event will remain. Access codes will remain.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90">
                    Yes, Reset Everything (Except Daily Life)
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {events.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="p-8 text-center space-y-4">
              <Info className="w-12 h-12 mx-auto text-primary" />
              <p className="text-xl text-muted-foreground">
                {isEditor ? "No events created yet (besides 'Daily Life')." : "No events have been set up yet (besides 'Daily Life')."}
              </p>
              {isEditor && (
                <p className="text-sm text-muted-foreground">
                  Click on "Create New Event" to get started.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card key={event.id} className="shadow-lg hover:shadow-xl transition-shadow duration-200 flex flex-col">
                <CardHeader>
                  <CardTitle className="font-headline text-2xl text-primary">{event.name}</CardTitle>
                  {!event.isEvergreen && event.startDate && event.endDate && (
                    <CardDescription className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4" />
                      {format(parseISO(event.startDate), "MMM d, yyyy")} - {format(parseISO(event.endDate), "MMM d, yyyy")}
                    </CardDescription>
                  )}
                  {event.isEvergreen && (
                    <CardDescription className="text-sm text-muted-foreground italic">An ongoing space for daily sharing.</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <EventStatus event={event} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleSelectEvent(event.id)} className="w-full">
                    View This Event <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        
        {isEditor && events.filter(e => !e.isEvergreen).length > 0 && ( // Show note only if there are deletable events
            <Card className="mt-8 bg-secondary/50 border-secondary">
                 <CardHeader>
                    <CardTitle className="text-lg flex items-center text-secondary-foreground">
                        <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" /> Editor Note on Event Deletion
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-secondary-foreground">
                        To delete individual events (other than 'Daily Life') and their associated logs, you will need to do so directly in the Firebase Firestore console for now.
                        Navigate to the 'events' collection to delete an event document, and then query the 'dailyLogs' collection for logs with the matching 'eventId' to delete them. The 'Daily Life' event cannot be deleted through this app.
                    </p>
                 </CardContent>
            </Card>
        )}

        <div className="mt-12 text-center">
          <Button variant="ghost" onClick={handleLogout} size="lg" className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-5 h-5 mr-2" /> Leave Our Space
          </Button>
        </div>

      </PageSection>
    </AppContainer>
  );
}

    