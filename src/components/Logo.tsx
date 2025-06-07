import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center space-x-2">
      <Image
        src="https://placehold.co/32x32.png" 
        alt="Notre Cocon Heart Logo" 
        width={32} 
        height={32}
        data-ai-hint="heart logo"
        className="h-8 w-8" 
      />
      <h1 className="font-headline text-4xl" style={{ color: 'hsl(var(--accent))' }}>
        Notre Cocon
      </h1>
    </div>
  );
}
