import type { ReactNode } from 'react';
import { Logo } from './Logo';
import Link from 'next/link';
import { Button } from './ui/button';
import { Home, Heart } from 'lucide-react';

interface AppContainerProps {
  children: ReactNode;
  showHomeButton?: boolean;
}

export function AppContainer({ children, showHomeButton = false }: AppContainerProps) {
  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
      <header className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <Logo />
        {showHomeButton && (
          <Button variant="ghost" asChild>
            <Link href="/" aria-label="Go to homepage">
              <Home className="w-6 h-6 text-primary" />
            </Link>
          </Button>
        )}
      </header>
      <main className="w-full max-w-4xl flex-grow">
        {children}
      </main>
      <footer className="w-full max-w-4xl mt-12 text-center py-4">
        <p className="text-sm text-muted-foreground">
          Made with <Heart className="inline h-4 w-4 text-accent fill-accent" /> for my special someone.
        </p>
      </footer>
    </div>
  );
}

// Helper component, not directly related to AppContainer but useful for page structure
export function PageSection({ title, children, titleClassName }: { title: string, children: ReactNode, titleClassName?: string }) {
  return (
    <section className="mb-8">
      <h2 className={`font-headline text-3xl mb-4 ${titleClassName || 'text-primary'}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}
