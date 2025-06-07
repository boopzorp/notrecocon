import { Heart } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center space-x-2">
      <Heart className="w-8 h-8 text-accent fill-accent" />
      <h1 className="font-headline text-4xl" style={{ color: 'hsl(var(--accent))' }}>
        Heartbeats Away
      </h1>
    </div>
  );
}
