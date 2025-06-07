"use client";

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2 } from 'lucide-react';
import { generateSuggestedReplies, type SuggestedRepliesOutput } from '@/ai/flows/suggested-replies'; // Assuming this path
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface DailyDetailsCardProps {
  selectedDate: Date;
  log: DailyLog | undefined;
  onSave: (date: Date, log: DailyLog) => void;
  onDelete?: (date: Date) => void; // Optional delete handler
  mode: 'editor' | 'reader';
}

export function DailyDetailsCard({ selectedDate, log, onSave, onDelete, mode }: DailyDetailsCardProps) {
  const [note, setNote] = useState('');
  const [spotifyLink, setSpotifyLink] = useState('');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);

  useEffect(() => {
    setNote(log?.note || '');
    setSpotifyLink(log?.spotifyLink || '');
    setSuggestedReplies([]); // Reset suggestions when log changes
    setErrorSuggestions(null);
  }, [log, selectedDate]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    onSave(selectedDate, { note, spotifyLink });
  };
  
  const handleDelete = () => {
    if (onDelete) {
      onDelete(selectedDate);
      setNote('');
      setSpotifyLink('');
    }
  };

  const handleGetSuggestions = async () => {
    if (!note.trim()) {
      setErrorSuggestions("Please write a note first to get suggestions.");
      return;
    }
    setIsLoadingSuggestions(true);
    setErrorSuggestions(null);
    setSuggestedReplies([]);
    try {
      const result: SuggestedRepliesOutput = await generateSuggestedReplies({ note });
      setSuggestedReplies(result.suggestedReplies);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      setErrorSuggestions("Could not fetch suggestions. Please try again.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const formattedDate = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (mode === 'reader') {
    if (!log || (!log.note && !log.spotifyLink)) {
      return (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary">{formattedDate}</CardTitle>
            <CardDescription>No entry for this day yet. Check back later!</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">{formattedDate}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {log.note && (
            <div>
              <Label className="text-muted-foreground font-semibold flex items-center"><BookOpen className="w-4 h-4 mr-2 text-accent"/> My Thoughts:</Label>
              <p className="whitespace-pre-wrap p-2 border rounded-md bg-background">{log.note}</p>
            </div>
          )}
          {log.spotifyLink && (
            <div>
              <Label className="text-muted-foreground font-semibold flex items-center"><Music2 className="w-4 h-4 mr-2 text-accent"/>Today's Song:</Label>
              <Button variant="link" asChild className="p-0 h-auto">
                <a href={log.spotifyLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">
                  {log.spotifyLink}
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <form onSubmit={handleSave}>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Log for {formattedDate}</CardTitle>
          <CardDescription>Share your thoughts and a song for this day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="note" className="flex items-center font-semibold"><BookOpen className="w-4 h-4 mr-2 text-accent"/>Your Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind today..."
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spotifyLink" className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Spotify Song Link</Label>
            <Input
              id="spotifyLink"
              type="url"
              value={spotifyLink}
              onChange={(e) => setSpotifyLink(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
            />
          </div>
          
          {note.trim() && (
            <div className="space-y-3">
              <Button type="button" variant="outline" onClick={handleGetSuggestions} disabled={isLoadingSuggestions} className="w-full sm:w-auto">
                <Lightbulb className="w-4 h-4 mr-2"/>
                {isLoadingSuggestions ? "Getting Suggestions..." : "Get Reply Suggestions"}
              </Button>
              {errorSuggestions && <p className="text-sm text-destructive">{errorSuggestions}</p>}
              {suggestedReplies.length > 0 && (
                <Alert variant="default" className="bg-secondary/50">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <AlertTitle className="font-headline text-lg text-accent">Reply Ideas!</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      {suggestedReplies.map((reply, index) => (
                        <li key={index} className="text-sm">{reply}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
          {onDelete && log && (
             <Button type="button" variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entry
              </Button>
          )}
          <Button type="submit" className="w-full sm:w-auto ml-auto">
            <Save className="w-4 h-4 mr-2"/> Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
