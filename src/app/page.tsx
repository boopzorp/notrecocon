import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppContainer } from '@/components/AppContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit3, Eye, Gift } from 'lucide-react';

export default function HomePage() {
  return (
    <AppContainer>
      <div className="flex flex-col items-center text-center space-y-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-4xl text-accent">Welcome!</CardTitle>
            <CardDescription className="text-muted-foreground text-lg">
              This little corner of the web is just for us.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-foreground">
              Choose your path below to continue our journey, even when miles apart.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                <Link href="/editor" className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5" />
                  Editor's Nook
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                <Link href="/reader" className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Reader's Haven
                </Link>
              </Button>
            </div>
             <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/setup" className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Setup/Reset
                </Link>
              </Button>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
