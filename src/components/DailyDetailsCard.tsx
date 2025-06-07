
"use client";

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2, PenLine, Gift, MessageSquarePlus, MessagesSquare, PlusCircle } from 'lucide-react';
import { generateSuggestedReplies, type SuggestedRepliesOutput } from '@/ai/flows/suggested-replies';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface DailyDetailsCardProps {
  selectedDate: Date;
  log: DailyLog | undefined;
  onSave: (date: Date, log: DailyLog) => void;
  onDelete?: (date: Date) => void;
  mode: 'editor' | 'reader';
}

export function DailyDetailsCard({ selectedDate, log, onSave, onDelete, mode }: DailyDetailsCardProps) {
  const [newEditorNoteText, setNewEditorNoteText] = useState('');
  const [spotifyLink, setSpotifyLink] = useState('');
  const [newPartnerNoteText, setNewPartnerNoteText] = useState(''); 
  
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);

  useEffect(() => {
    setNewEditorNoteText(''); // Clear for new editor note entry
    setSpotifyLink(log?.spotifyLink || '');
    setNewPartnerNoteText(''); // Always clear for new partner note entry
    setSuggestedReplies([]); 
    setErrorSuggestions(null);
  }, [log, selectedDate]);

  const handleEditorSaveNewNote = (e: FormEvent) => {
    e.preventDefault();
    if (!newEditorNoteText.trim() && !spotifyLink.trim() && (!log?.editorNotes || log.editorNotes.length === 0) && !log?.spotifyLink) { 
      // Allow saving just the spotify link even if note is empty, or if there are existing notes.
      // Only prevent save if everything is empty.
    }

    const updatedLog: DailyLog = {
      editorNotes: newEditorNoteText.trim() 
        ? [...(log?.editorNotes || []), newEditorNoteText] 
        : (log?.editorNotes || []),
      spotifyLink,
      partnerNotes: log?.partnerNotes || [],
    };
    onSave(selectedDate, updatedLog);
    setNewEditorNoteText(''); // Clear input after saving
  };
  
  const handlePartnerSaveNewNote = (e: FormEvent) => {
    e.preventDefault();
    if (!newPartnerNoteText.trim()) return; 

    const updatedLog: DailyLog = {
      editorNotes: log?.editorNotes || [],
      spotifyLink: log?.spotifyLink || '',
      partnerNotes: [...(log?.partnerNotes || []), newPartnerNoteText],
    };
    onSave(selectedDate, updatedLog);
    setNewPartnerNoteText(''); 
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(selectedDate);
      setNewEditorNoteText('');
      setSpotifyLink('');
      setNewPartnerNoteText(''); 
    }
  };

  const handleGetSuggestions = async () => {
    const noteToAnalyze = mode === 'editor' ? newEditorNoteText : (log?.editorNotes?.[(log.editorNotes.length || 0) -1] || "");

    if (!noteToAnalyze.trim()) {
      setErrorSuggestions( mode === 'editor' ? "Please write your new note first to get suggestions." : "The main note is empty, cannot generate suggestions.");
      return;
    }
    setIsLoadingSuggestions(true);
    setErrorSuggestions(null);
    setSuggestedReplies([]);
    try {
      const result: SuggestedRepliesOutput = await generateSuggestedReplies({ note: noteToAnalyze });
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
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">{formattedDate}</CardTitle>
          {(!log || (!log.editorNotes?.length && !log.spotifyLink && !log.partnerNotes?.length)) && (
             <CardDescription>No entries for this day yet. Be the first to leave a note!</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {log?.editorNotes && log.editorNotes.length > 0 && (
            <div>
              <Label className="text-muted-foreground font-semibold flex items-center"><BookOpen className="w-4 h-4 mr-2 text-accent"/> Their Thoughts:</Label>
              <ul className="space-y-2 mt-1">
                {log.editorNotes.map((eNote, index) => (
                  <li key={`editor-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/30">
                    {eNote}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {log?.spotifyLink && (
            <div>
              <Label className="text-muted-foreground font-semibold flex items-center"><Music2 className="w-4 h-4 mr-2 text-accent"/>Their Song for the Day:</Label>
              <Button variant="link" asChild className="p-0 h-auto">
                <a href={log.spotifyLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">
                  {log.spotifyLink}
                </a>
              </Button>
            </div>
          )}

          {log?.partnerNotes && log.partnerNotes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Label className="font-semibold flex items-center"><MessagesSquare className="w-5 h-5 mr-2 text-accent"/>Your Notes for Them:</Label>
              <ul className="space-y-2 mt-2">
                {log.partnerNotes.map((pNote, index) => (
                  <li key={`partner-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-background shadow-sm">
                    {pNote}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <form onSubmit={handlePartnerSaveNewNote} className="space-y-3 pt-6 border-t">
            <Label htmlFor="newPartnerNote" className="flex items-center font-semibold text-base">
              <MessageSquarePlus className="w-5 h-5 mr-2 text-accent"/>Add Your Note:
            </Label>
            <Textarea
              id="newPartnerNote"
              value={newPartnerNoteText}
              onChange={(e) => setNewPartnerNoteText(e.target.value)}
              placeholder="Leave a sweet message for them..."
              rows={3}
              className="bg-white"
            />
             <Button type="submit" className="w-full sm:w-auto" disabled={!newPartnerNoteText.trim()}>
                <Save className="w-4 h-4 mr-2"/> Add My Note
              </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Editor Mode
  return (
    <Card className="shadow-md">
      <form onSubmit={handleEditorSaveNewNote}>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Log for {formattedDate}</CardTitle>
          <CardDescription>Share your thoughts, a song, and see notes from your partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {log?.editorNotes && log.editorNotes.length > 0 && (
            <div className="space-y-2">
              <Label className="font-semibold flex items-center"><BookOpen className="w-4 h-4 mr-2 text-accent"/>Your Saved Notes:</Label>
              <ul className="space-y-2 mt-1">
                {log.editorNotes.map((eNote, index) => (
                  <li key={`editor-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/50">
                    {eNote}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="newEditorNoteText" className="flex items-center font-semibold"><PenLine className="w-4 h-4 mr-2 text-accent"/>Add a New Note</Label>
            <Textarea
              id="newEditorNoteText"
              value={newEditorNoteText}
              onChange={(e) => setNewEditorNoteText(e.target.value)}
              placeholder="What's on your mind today..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spotifyLink" className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Spotify Song Link (Optional)</Label>
            <Input
              id="spotifyLink"
              type="url"
              value={spotifyLink}
              onChange={(e) => setSpotifyLink(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
            />
          </div>
          
          {log?.partnerNotes && log.partnerNotes.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
                <Label className="text-muted-foreground font-semibold flex items-center"><Gift className="w-5 h-5 mr-2 text-accent"/>Notes From Your Partner:</Label>
                 <ul className="space-y-2 mt-1">
                    {log.partnerNotes.map((pNote, index) => (
                    <li key={`partner-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/50">
                        {pNote}
                    </li>
                    ))}
                </ul>
            </div>
          )}

          {newEditorNoteText.trim() && (
            <div className="space-y-3 pt-4 border-t">
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
          {onDelete && (log?.editorNotes?.length || log?.spotifyLink || log?.partnerNotes?.length) && ( 
             <Button type="button" variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button type="submit" className="w-full sm:w-auto ml-auto">
            <PlusCircle className="w-4 h-4 mr-2"/> Add Note / Update Link
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
