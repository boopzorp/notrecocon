
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { formatISO, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, Save, Trash2, Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


export default function SetupPage() {
  const { eventName: currentEventName, eventStartDate: currentEventStartDate, eventEndDate: currentEventEndDate, setEventDetails, resetData, isConfigured } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const [eventName, setEventName] = useState<string>(currentEventName || '');
  const [startDate, setStartDate] = useState<Date | undefined>(
    currentEventStartDate && isValid(parseISO(currentEventStartDate)) ? parseISO(currentEventStartDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    currentEventEndDate && isValid(parseISO(currentEventEndDate)) ? parseISO(currentEventEndDate) : undefined
  );

  useEffect(() => {
    setEventName(currentEventName || '');
    setStartDate(currentEventStartDate && isValid(parseISO(currentEventStartDate)) ? parseISO(currentEventStartDate) : undefined);
    setEndDate(currentEventEndDate && isValid(parseISO(currentEventEndDate)) ? parseISO(currentEventEndDate) : undefined);
  }, [currentEventName, currentEventStartDate, currentEventEndDate]);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      toast({
        title: "Missing Event Name",
        description: "Please provide a name for the event.",
        variant: "destructive",
      });
      return;
    }
    if (startDate && endDate) {
      if (endDate < startDate) {
        toast({
          title: "Invalid Dates",
          description: "End date cannot be before start date.",
          variant: "destructive",
        });
        return;
      }
      setEventDetails(eventName.trim(), startDate, endDate);
      toast({
        title: "Event Details Saved!",
        description: "The current event details have been configured.",
      });
      router.push('/editor'); 
    } else {
      toast({
        title: "Missing Dates",
        description: "Please select both start and end dates.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    resetData(); // This will clear eventName, eventStartDate, eventEndDate in context
    setEventName(''); // Clear local state
    setStartDate(undefined);
    setEndDate(undefined);
    toast({
      title: "Data Reset",
      description: "All application data, including event details, has been cleared.",
    });
  };

  return (
    <AppContainer showHomeButton={true}>
      <PageSection title="Configure Current Event" titleClassName="text-accent">
        <Card className="w-full max-w-lg mx-auto shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="font-headline text-3xl text-primary">Set The Timeline</CardTitle>
              <CardDescription>
                {isConfigured() 
                  ? "Update the current event's name, start and end dates. This will define the calendar range and progress."
                  : "Define the current event's name, start and end dates to begin using the app."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="eventName" className="font-semibold flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-primary"/> Event Name
                </Label>
                <Input
                  id="eventName"
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Our Special Trip, Her Internship"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate" className="font-semibold">Event Start Date</Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? formatISO(startDate, { representation: 'date' }) : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="font-semibold">Event End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? formatISO(endDate, { representation: 'date' }) : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={startDate ? { before: startDate } : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
              <Button type="button" variant="destructive" onClick={handleReset} className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-2"/> Reset All Data
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2"/> Save Event Details
              </Button>
            </CardFooter>
          </form>
        </Card>
      </PageSection>
    </AppContainer>
  );
}
