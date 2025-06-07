
"use client";

import { AppContainer, PageSection } from '@/components/AppContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function ObsoleteSetupPage() {
  return (
    <AppContainer showHomeButton={true}>
      <PageSection title="Setup Has Moved" titleClassName="text-accent">
        <Card className="w-full max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-3xl text-primary">Event Setup Changed</CardTitle>
            <CardDescription>
              Event setup and management is now handled on the main "Events" page after you log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Please log in to access the new event management features.</p>
            <Button asChild>
              <Link href="/events" className="flex items-center gap-2">
                Go to Events Page <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageSection>
    </AppContainer>
  );
}
