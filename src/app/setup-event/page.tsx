
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useAppContext } from '@/context/AppContext';
import { AppContainer, PageSection } from '@/components/AppContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarDays, PlusCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: "Event name must be at least 3 characters long." }).max(100, { message: "Event name must be 100 characters or less." }),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  endDate: z.date({
    required_error: "An end date is required.",
  }),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function SetupEventPage() {
  const { userRole, isInitialized, addEvent } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: "",
      startDate: undefined,
      endDate: undefined,
    }
  });

  useEffect(() => {
    if (isInitialized && userRole !== 'editor') {
      toast({
        title: "Access Denied",
        description: "Only the editor can set up new events.",
        variant: "destructive",
      });
      router.replace('/events');
    }
  }, [isInitialized, userRole, router, toast]);

  const onSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    const eventData = {
      name: data.name,
      startDate: format(data.startDate, 'yyyy-MM-dd'),
      endDate: format(data.endDate, 'yyyy-MM-dd'),
    };

    const eventId = await addEvent(eventData);

    if (eventId) {
      toast({
        title: "Event Created!",
        description: `The event "${data.name}" has been successfully created.`,
        className: "bg-secondary text-secondary-foreground",
      });
      router.push('/events');
    } else {
      toast({
        title: "Error Creating Event",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  if (!isInitialized) {
    return (
      <AppContainer showHomeButton={false}>
        <PageSection title="Create New Event">
          <div className="flex justify-center items-center h-64">
            <p className="text-xl text-muted-foreground">Initializing...</p>
          </div>
        </PageSection>
      </AppContainer>
    );
  }
  
  if (userRole !== 'editor') {
     return (
      <AppContainer showHomeButton={false}>
        <PageSection title="Access Denied">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-destructive">You do not have permission to access this page.</p>
              <Button asChild variant="link" className="mt-4">
                <Link href="/events">Go to Events</Link>
              </Button>
            </CardContent>
          </Card>
        </PageSection>
      </AppContainer>
    );
  }

  return (
    <AppContainer showHomeButton={false}>
      <PageSection title="Create a New Special Event" titleClassName="text-accent">
        <Card className="w-full max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-3xl text-primary">New Event Details</CardTitle>
            <CardDescription>
              Define a new event for you and your partner to share entries for.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Our Summer Adventure" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP") // e.g., Jun 7, 2025
                                ) : (
                                  <span>Pick a start date</span>
                                )}
                                <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick an end date</span>
                                )}
                                <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => 
                                form.getValues("startDate") && date < form.getValues("startDate")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
                 <Button type="button" variant="outline" asChild>
                  <Link href="/events">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Events
                  </Link>
                </Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Event
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </PageSection>
    </AppContainer>
  );
}
