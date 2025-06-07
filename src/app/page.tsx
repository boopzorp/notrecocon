
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppContainer } from '@/components/AppContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit3, Eye, Gift, LogOut } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { userRole, isInitialized, setUserRole } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !userRole) {
      router.replace('/safe-space');
    }
  }, [isInitialized, userRole, router]);

  if (!isInitialized || !userRole) {
    // Show a loading state or minimal content while redirecting or initializing
    // This will typically be very brief as the useEffect above will redirect.
    return (
      <AppContainer>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Loading your space...</p>
        </div>
      </AppContainer>
    );
  }

  const isPartner = userRole === 'partner';

  const handleLogout = () => {
    setUserRole(null); 
    router.push('/safe-space'); // Explicitly redirect to safe-space
  };

  return (
    <AppContainer>
      <div className="flex flex-col items-center text-center space-y-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-4xl text-accent">Welcome Back!</CardTitle>
            <CardDescription className="text-muted-foreground text-lg">
              This little corner of the web is just for us.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-foreground">
              Choose your path below to continue our journey, even when miles apart.
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
             {!isPartner && (
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href="/setup" className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Setup/Reset
                  </Link>
                </Button>
              )}
              <Button variant="ghost" onClick={handleLogout} size="lg" className="w-full sm:w-auto text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" /> Leave Our Space
              </Button>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
