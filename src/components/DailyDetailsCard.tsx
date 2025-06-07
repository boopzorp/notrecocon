
"use client";

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog, MoodEntry } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2, PenLine, Gift, MessageSquarePlus, MessagesSquare, PlusCircle, Search, Loader2, MessageCircleQuestion, MessageCircleHeart, Smile } from 'lucide-react';
import { generateSuggestedReplies, type SuggestedRepliesOutput } from '@/ai/flows/suggested-replies';
import { extractSongDetails, type ExtractSongDetailsOutput } from '@/ai/flows/extract-song-details-flow';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DailyDetailsCardProps {
  selectedDate: Date;
  log: DailyLog | undefined;
  onSave: (date: Date, log: DailyLog) => void;
  onDelete?: (date: Date) => void;
  mode: 'editor' | 'reader';
}

const MOOD_OPTIONS = ['😊', '😢', '😠', '😴', '🎉', '😐', '💖', '🙂', '😟'] as const;
type MoodEmoji = typeof MOOD_OPTIONS[number];


export function DailyDetailsCard({ selectedDate, log, onSave, onDelete, mode }: DailyDetailsCardProps) {
  const [newEditorNoteText, setNewEditorNoteText] = useState('');
  const [spotifyLink, setSpotifyLink] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [newPartnerNoteText, setNewPartnerNoteText] = useState('');
  const [promptForPartner, setPromptForPartner] = useState('');
  const [promptForEditor, setPromptForEditor] = useState('');
  const [currentEditorMood, setCurrentEditorMood] = useState<MoodEmoji | undefined>(undefined);
  const [currentPartnerMood, setCurrentPartnerMood] = useState<MoodEmoji | undefined>(undefined);


  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);

  const [isFetchingSongDetails, setIsFetchingSongDetails] = useState(false);
  const [songDetailsError, setSongDetailsError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    setNewEditorNoteText('');
    setSpotifyLink(log?.spotifyLink || '');
    setSongTitle(log?.songTitle || '');
    setNewPartnerNoteText('');
    setPromptForPartner(log?.promptForPartner || '');
    setPromptForEditor(log?.promptForEditor || '');
    setCurrentEditorMood(log?.moods?.editor as MoodEmoji || undefined);
    setCurrentPartnerMood(log?.moods?.partner as MoodEmoji || undefined);
    setSuggestedReplies([]);
    setErrorSuggestions(null);
    setSongDetailsError(null);
    setIsFetchingSongDetails(false);
  }, [log, selectedDate]);


  const handleEditorSave = async (e: FormEvent) => {
    e.preventDefault();

    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };

    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      editorNotes: newEditorNoteText.trim()
        ? [...(currentLogSnapshot.editorNotes || []), newEditorNoteText]
        : (currentLogSnapshot.editorNotes || []),
      spotifyLink: spotifyLink.trim(),
      songTitle: songTitle.trim(),
      promptForPartner: promptForPartner.trim(),
      partnerNotes: currentLogSnapshot.partnerNotes || [],
      promptForEditor: currentLogSnapshot.promptForEditor || '',
      moods: {
        editor: currentEditorMood,
        partner: currentLogSnapshot.moods?.partner,
      }
    };

    onSave(selectedDate, updatedLog);
    setNewEditorNoteText('');
  };

  const handlePartnerSave = async (e: FormEvent) => {
    e.preventDefault();

    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };

    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      partnerNotes: newPartnerNoteText.trim() ? [...(currentLogSnapshot.partnerNotes || []), newPartnerNoteText] : (currentLogSnapshot.partnerNotes || []),
      promptForEditor: promptForEditor.trim(),
      editorNotes: currentLogSnapshot.editorNotes || [],
      spotifyLink: currentLogSnapshot.spotifyLink || '',
      songTitle: currentLogSnapshot.songTitle || '',
      promptForPartner: currentLogSnapshot.promptForPartner || '',
      moods: {
        editor: currentLogSnapshot.moods?.editor,
        partner: currentPartnerMood,
      }
    };

    onSave(selectedDate, updatedLog);
    setNewPartnerNoteText('');
  };

  const handleDeleteEntireEntry = async () => {
    if (onDelete) {
      onDelete(selectedDate);
    }
  };

  const handleDeletePartnerNote = (indexToDelete: number) => {
     const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };
    const currentPartnerNotes = currentLogSnapshot.partnerNotes;

    if (!currentPartnerNotes || indexToDelete < 0 || indexToDelete >= currentPartnerNotes.length) {
      console.error("Invalid index for deleting partner note.");
      toast({ title: "Error", description: "Could not delete partner note: invalid index.", variant: "destructive"});
      return;
    }
    const updatedPartnerNotes = currentPartnerNotes.filter((_, index) => index !== indexToDelete);

    const updatedLog: DailyLog = { ...currentLogSnapshot, partnerNotes: updatedPartnerNotes };
    onSave(selectedDate, updatedLog);
    toast({ title: "Note Deleted", description: "Your partner's note has been successfully deleted." });
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

  const isValidSpotifyTrackUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'open.spotify.com' && (parsedUrl.pathname.startsWith('/track/') || parsedUrl.pathname.startsWith('/episode/'));
    } catch (e) {
      return false;
    }
  };

  const handleFetchSongDetailsFromLink = async () => {
    if (!spotifyLink || !isValidSpotifyTrackUrl(spotifyLink)) {
      setSongDetailsError("Please enter a valid Spotify track or episode URL.");
      return;
    }
    setIsFetchingSongDetails(true);
    setSongDetailsError(null);
    try {
      const result: ExtractSongDetailsOutput = await extractSongDetails({ spotifyUrl: spotifyLink });
      setSongTitle(result.songTitle);
      toast({ title: "Song Details Fetched!", description: `Found title: ${result.songTitle}` });
    } catch (error: any) {
      console.error("Error fetching song details:", error);
      setSongDetailsError(error.message || "Could not fetch song details. Please check the link or try again.");
      toast({ title: "Error Fetching Song Details", description: error.message || "Could not fetch song details.", variant: "destructive" });
    } finally {
      setIsFetchingSongDetails(false);
    }
  };

  const renderMoodSelector = (currentMood: MoodEmoji | undefined, onSelectMood: (mood: MoodEmoji) => void, label: string) => (
    <div className="space-y-2">
      <Label className="flex items-center font-semibold"><Smile className="w-4 h-4 mr-2 text-accent"/> {label}</Label>
      <div className="flex flex-wrap gap-2">
        {MOOD_OPTIONS.map(moodEmoji => (
          <Button
            key={moodEmoji}
            type="button"
            variant={currentMood === moodEmoji ? "default" : "outline"}
            size="icon"
            onClick={() => onSelectMood(moodEmoji)}
            className={`text-2xl p-2 rounded-full w-12 h-12 ${currentMood === moodEmoji ? 'border-2 border-primary-foreground ring-2 ring-primary' : ''}`}
            aria-label={`Select mood: ${moodEmoji}`}
          >
            {moodEmoji}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderTheirMood = (mood: MoodEmoji | undefined, label: string) => {
    if (!mood) return null;
    return (
      <div className="p-3 border rounded-md bg-secondary/30 shadow-sm">
        <Label className="text-muted-foreground font-semibold flex items-center mb-1">
          <Smile className="w-4 h-4 mr-2 text-accent"/> {label}
        </Label>
        <p className="text-3xl">{mood}</p>
      </div>
    );
  };


  const formattedDateDisplay = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Reader Mode (Partner's View)
  if (mode === 'reader') {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">{formattedDateDisplay}</CardTitle>
          {(!log || (!log.editorNotes?.length && !log.spotifyLink && !log.partnerNotes?.length && !log.promptForPartner && !log.promptForEditor && !log.moods?.editor && !log.moods?.partner)) && (
             <CardDescription>No entries for this day yet. Be the first to leave a note or a prompt!</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {renderTheirMood(log?.moods?.editor as MoodEmoji | undefined, "Their Mood Today:")}
          {log?.promptForPartner && (
            <div className="p-3 border rounded-md bg-secondary/30 shadow-sm">
              <Label className="text-muted-foreground font-semibold flex items-center mb-1"><MessageCircleQuestion className="w-4 h-4 mr-2 text-accent"/>Their Prompt for You:</Label>
              <p className="whitespace-pre-wrap text-sm">{log.promptForPartner}</p>
            </div>
          )}

          {log?.editorNotes && log.editorNotes.length > 0 && (
            <div>
              <Label className="text-muted-foreground font-semibold flex items-center"><BookOpen className="w-4 h-4 mr-2 text-accent"/> Their Thoughts:</Label>
              <ul className="space-y-2 mt-1">
                {log.editorNotes.map((eNote, index) => (
                  <li key={`reader-editor-note-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/30">
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
                <a href={log.spotifyLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block text-left">
                  {log.songTitle ? log.songTitle : log.spotifyLink}
                </a>
              </Button>
            </div>
          )}
          
          {log?.partnerNotes && log.partnerNotes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Label className="font-semibold flex items-center"><MessagesSquare className="w-5 h-5 mr-2 text-accent"/>Your Notes for Them:</Label>
              <ul className="space-y-2 mt-2">
                {log.partnerNotes.map((pNote, index) => (
                  <li key={`partner-note-${index}`} className="flex justify-between items-start whitespace-pre-wrap text-sm p-3 border rounded-md bg-background shadow-sm">
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

          <form onSubmit={handlePartnerSave} className="space-y-4 pt-6 border-t">
            {renderMoodSelector(currentPartnerMood, setCurrentPartnerMood, "Your Mood Today:")}
            <div className="space-y-2">
              <Label htmlFor="promptForEditor" className="flex items-center font-semibold text-base"><MessageCircleHeart className="w-5 h-5 mr-2 text-accent"/>Your Prompt for Them:</Label>
              <Textarea
                id="promptForEditor"
                value={promptForEditor}
                onChange={(e) => setPromptForEditor(e.target.value)}
                placeholder="Ask them something or leave a sweet thought..."
                rows={2}
                className="bg-white"
              />
            </div>

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
             <Button type="submit" className="w-full" disabled={!newPartnerNoteText.trim() && !promptForEditor.trim() && !currentPartnerMood}>
                <Save className="w-4 h-4 mr-2"/>
                Add My Note, Prompt & Mood
              </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Editor Mode
  return (
    <Card className="shadow-md">
      <form onSubmit={handleEditorSave}>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Log for {formattedDateDisplay}</CardTitle>
          <CardDescription>Share your thoughts, mood, a song, prompts, and see notes from your partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderMoodSelector(currentEditorMood, setCurrentEditorMood, "Your Mood Today:")}
          {renderTheirMood(log?.moods?.partner as MoodEmoji | undefined, "Their Mood Today:")}

          {log?.promptForEditor && (
             <div className="p-3 border rounded-md bg-secondary/50 shadow-sm">
              <Label className="text-muted-foreground font-semibold flex items-center mb-1"><MessageCircleHeart className="w-4 h-4 mr-2 text-accent"/>Their Prompt for You:</Label>
              <p className="whitespace-pre-wrap text-sm">{log.promptForEditor}</p>
            </div>
          )}

          {log?.editorNotes && log.editorNotes.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="font-semibold flex items-center"><BookOpen className="w-4 h-4 mr-2 text-accent"/>Your Saved Notes:</Label>
              <ul className="space-y-2 mt-1">
                {log.editorNotes.map((eNote, index) => (
                   <li key={`editor-note-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/50">
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
            <Label htmlFor="promptForPartner" className="flex items-center font-semibold"><MessageCircleQuestion className="w-4 h-4 mr-2 text-accent"/>Your Prompt for Them:</Label>
            <Textarea
              id="promptForPartner"
              value={promptForPartner}
              onChange={(e) => setPromptForPartner(e.target.value)}
              placeholder="Ask them something or leave a special thought..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spotifyLink" className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Spotify Song/Episode Link</Label>
            <div className="flex items-center gap-2">
              <Input
                id="spotifyLink"
                type="url"
                value={spotifyLink}
                onChange={(e) => {
                  setSpotifyLink(e.target.value);
                  setSongDetailsError(null);
                }}
                onBlur={handleFetchSongDetailsFromLink}
                placeholder="https://open.spotify.com/track/..."
                className="flex-grow"
              />
              <Button
                type="button"
                onClick={handleFetchSongDetailsFromLink}
                disabled={isFetchingSongDetails || !isValidSpotifyTrackUrl(spotifyLink)}
                variant="outline"
                size="icon"
                aria-label="Fetch song details"
              >
                {isFetchingSongDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {songDetailsError && <p className="text-sm text-destructive mt-1">{songDetailsError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="songTitle" className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Song/Episode Title</Label>
            <Input
              id="songTitle"
              type="text"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="e.g., Sunflower (auto-filled from link)"
            />
          </div>

          {log?.partnerNotes && log.partnerNotes.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
                <Label className="text-muted-foreground font-semibold flex items-center"><Gift className="w-5 h-5 mr-2 text-accent"/>Notes From Your Partner:</Label>
                 <ul className="space-y-2 mt-1">
                    {log.partnerNotes.map((pNote, index) => (
                    <li key={`editor-partner-note-${index}`} className="whitespace-pre-wrap text-sm p-3 border rounded-md bg-secondary/50">
                        {pNote}
                    </li>
                    ))}
                </ul>
            </div>
          )}

          {(newEditorNoteText.trim() || (log?.editorNotes && log.editorNotes.length > 0)) && (
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
          {onDelete && (log?.editorNotes?.length || log?.spotifyLink || log?.partnerNotes?.length || log?.songTitle || log?.promptForEditor || log?.promptForPartner || log?.moods?.editor || log?.moods?.partner) && (
             <Button type="button" variant="destructive" onClick={handleDeleteEntireEntry} className="w-full">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button 
            type="submit" 
            className="w-full whitespace-normal text-center h-auto" 
            disabled={
              !newEditorNoteText.trim() && 
              !spotifyLink.trim() && 
              !songTitle.trim() && 
              !promptForPartner.trim() && 
              !currentEditorMood &&
              // Disable if nothing new AND nothing existing to simply re-save/update mood on
              !(log?.editorNotes?.length || log?.spotifyLink || log?.songTitle || log?.promptForPartner || log?.moods?.editor)
            }
          >
            <PlusCircle className="w-4 h-4 mr-2"/>
            Add Note / Update Details, Prompt & Mood
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

