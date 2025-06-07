
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppContainer } from '@/components/AppContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit3, Eye, LogOut, Briefcase } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { userRole, isInitialized, setUserRole, selectedEvent } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized) {
      if (!userRole) {
        router.replace('/safe-space');
      } else if (!selectedEvent) {
        router.replace('/events');
      }
    }
  }, [isInitialized, userRole, selectedEvent, router]);

  if (!isInitialized || !userRole || !selectedEvent) {
    return (
      <AppContainer>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Loading your space or redirecting...</p>
        </div>
      </AppContainer>
    );
  }

  const isPartner = userRole === 'partner';

  const handleLogout = () => {
    setUserRole(null); 
    router.push('/safe-space'); 
  };

  return (
    <AppContainer>
      <div className="flex flex-col items-center text-center space-y-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-4xl text-accent">Welcome Back!</CardTitle>
            <CardDescription className="text-muted-foreground text-lg">
              This little corner of the web is just for us, for our event: <span className="font-semibold text-primary">{selectedEvent.name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-foreground">
              Beyond time, Beyond distance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isPartner && (
                <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                  <Link href="/editor" className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5" />
                    Editor's Nook
                  </Link>
                </Button>
              )}
              <Button 
                asChild 
                variant={isPartner ? "default" : "secondary"} 
                size="lg" 
                className={`w-full sm:w-auto ${isPartner ? 'bg-primary hover:bg-primary/90' : ''}`}
              >
                <Link href="/reader" className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Reader's Haven
                </Link>
              </Button>
            </div>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/events" className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Change Event
              </Link>
            </Button>
            <Button variant="ghost" onClick={handleLogout} size="lg" className="w-full sm:w-auto text-muted-foreground hover:text-destructive">
              <LogOut className="w-5 h-5" /> Leave Our Space
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
