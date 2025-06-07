
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
import { useToast } from '@/hooks/use-toast';

interface DailyDetailsCardProps {
  selectedDate: Date;
  log: DailyLog | undefined;
  onSave: (date: Date, log: DailyLog) => void;
  onDelete?: (date: Date) => void; // For deleting entire day's entry
  mode: 'editor' | 'reader';
}

export function DailyDetailsCard({ selectedDate, log, onSave, onDelete, mode }: DailyDetailsCardProps) {
  const [newEditorNoteText, setNewEditorNoteText] = useState('');
  const [spotifyLink, setSpotifyLink] = useState('');
  const [newPartnerNoteText, setNewPartnerNoteText] = useState(''); 
  
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setNewEditorNoteText(''); 
    setSpotifyLink(log?.spotifyLink || '');
    setNewPartnerNoteText(''); 
    setSuggestedReplies([]); 
    setErrorSuggestions(null);
  }, [log, selectedDate]);

  const handleEditorSaveNewNote = (e: FormEvent) => {
    e.preventDefault();
    // No validation needed here to allow saving just a link or just a note
    
    const updatedLog: DailyLog = {
      editorNotes: newEditorNoteText.trim() 
        ? [...(log?.editorNotes || []), newEditorNoteText] 
        : (log?.editorNotes || []),
      spotifyLink: spotifyLink.trim(),
      partnerNotes: log?.partnerNotes || [],
    };
    onSave(selectedDate, updatedLog);
    setNewEditorNoteText(''); 
    // Toast handled by parent EditorPage
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
    // Toast handled by parent ReaderPage
  };

  const handleDeleteEntireEntry = () => {
    if (onDelete) {
      onDelete(selectedDate); 
      setNewEditorNoteText('');
      setSpotifyLink('');
      setNewPartnerNoteText(''); 
    }
  };

  const handleDeleteEditorNote = (indexToDelete: number) => {
    const currentEditorNotes = log?.editorNotes || [];
    if (indexToDelete < 0 || indexToDelete >= currentEditorNotes.length) {
      console.error("Invalid index for deleting editor note.");
      return;
    }
    const updatedEditorNotes = currentEditorNotes.filter((_, index) => index !== indexToDelete);
    
    // Explicitly construct the log with the updated editorNotes
    // and current values for other fields from the editor's perspective.
    const updatedLog: DailyLog = {
      editorNotes: updatedEditorNotes,
      spotifyLink: spotifyLink, // Use the current value from the spotifyLink input state
      partnerNotes: log?.partnerNotes || [], // Preserve existing partner notes
    };
    onSave(selectedDate, updatedLog);
    toast({
      title: "Note Deleted",
      description: "Your note has been successfully deleted.",
      variant: "destructive"
    });
  };

  const handleDeletePartnerNote = (indexToDelete: number) => {
    const currentPartnerNotes = log?.partnerNotes || [];
    if (indexToDelete < 0 || indexToDelete >= currentPartnerNotes.length) {
      console.error("Invalid index for deleting partner note.");
      return;
    }
    const updatedPartnerNotes = currentPartnerNotes.filter((_, index) => index !== indexToDelete);

    // Explicitly construct the log with the updated partnerNotes
    // and current values for other fields from the log prop.
    const updatedLog: DailyLog = {
      editorNotes: log?.editorNotes || [], // Preserve existing editor notes
      spotifyLink: log?.spotifyLink || '',   // Preserve existing spotify link
      partnerNotes: updatedPartnerNotes,
    };
    onSave(selectedDate, updatedLog);
    toast({
      title: "Note Deleted",
      description: "Your note has been successfully deleted.",
      variant: "destructive"
    });
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
                  <li key={`partner-${index}`} className="flex justify-between items-start whitespace-pre-wrap text-sm p-3 border rounded-md bg-background shadow-sm">
                    <span>{pNote}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePartnerNote(index)} className="h-6 w-6 p-0 ml-2 shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                      <span className="sr-only">Delete this note</span>
                    </Button>
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
                  <li key={`editor-${index}`} className="flex justify-between items-start whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/50">
                     <span>{eNote}</span>
                     <Button variant="ghost" size="icon" onClick={() => handleDeleteEditorNote(index)} className="h-6 w-6 p-0 ml-2 shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                       <span className="sr-only">Delete this note</span>
                    </Button>
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
        <CardFooter className="flex flex-col gap-3">
          {onDelete && (log?.editorNotes?.length || log?.spotifyLink || log?.partnerNotes?.length) && ( 
             <Button type="button" variant="destructive" onClick={handleDeleteEntireEntry} className="w-full">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button type="submit" className="w-full whitespace-normal text-center h-auto">
            <PlusCircle className="w-4 h-4 mr-2"/> Add Note / Update Link
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

