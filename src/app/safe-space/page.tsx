
"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AppContainer } from '@/components/AppContainer';
import { ShieldAlert } from 'lucide-react'; // KeyRound removed
import { useToast } from '@/hooks/use-toast';

export default function SafeSpacePage() {
  const { attemptLoginWithCode, isInitialized, globalConfig } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const editorCode = globalConfig?.editorCode;
  const partnerCode = globalConfig?.partnerCode;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!code.trim()) {
      setError("Please enter your special code.");
      setIsLoading(false);
      return;
    }

    const loginSuccess = attemptLoginWithCode(code);

    if (loginSuccess) {
      toast({
        title: "Welcome!",
        description: "You've successfully entered Our Safe Space.",
      });
      router.push('/events'); 
    } else {
      setError("That code doesn't seem right. Please try again.");
      toast({
        title: "Access Denied",
        description: "The code entered was incorrect.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (!isInitialized) {
    return (
      <AppContainer>
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-muted-foreground">Initializing Our Space...</p>
        </div>
      </AppContainer>
    );
  }
  
  const codesNotConfigured = isInitialized && (!globalConfig || (!editorCode && !partnerCode));

  return (
    <AppContainer>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Card className="w-full max-w-md shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="text-center">
              {/* KeyRound icon removed from here */}
              <CardTitle className="font-headline text-4xl text-accent pt-4">Our Safe Space</CardTitle>
              <CardDescription className="text-muted-foreground text-lg">
                A space for everything that matters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {codesNotConfigured && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
                  <div className="flex">
                    <div className="py-1"><ShieldAlert className="h-6 w-6 text-yellow-500 mr-3" /></div>
                    <div>
                      <p className="font-bold">Attention Editor!</p>
                      <p className="text-sm">Access codes are not yet configured in the application settings (Firestore: config/appSettings). Please set them up to enable access.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="font-semibold">Your Secret Code</Label>
                <Input
                  id="accessCode"
                  type="password" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code here"
                  className="text-center text-lg"
                  disabled={codesNotConfigured || isLoading}
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full text-lg py-6" disabled={codesNotConfigured || isLoading}>
                {isLoading ? "Verifying..." : "Enter Our Space"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppContainer>
  );
}
