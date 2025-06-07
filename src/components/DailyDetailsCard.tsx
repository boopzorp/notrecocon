
"use client";

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog, MoodEntry, SongEntry } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2, PenLine, Gift, MessageSquarePlus, MessagesSquare, PlusCircle, Search, Loader2, MessageCircleQuestion, MessageCircleHeart, Smile, ChevronDown } from 'lucide-react';
import { generateSuggestedReplies, type SuggestedRepliesOutput } from '@/ai/flows/suggested-replies';
import { extractSongDetails, type ExtractSongDetailsOutput } from '@/ai/flows/extract-song-details-flow';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


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
  const [newPartnerNoteText, setNewPartnerNoteText] = useState('');
  const [promptForPartner, setPromptForPartner] = useState('');
  const [promptForEditor, setPromptForEditor] = useState('');
  const [currentEditorMood, setCurrentEditorMood] = useState<MoodEmoji | null>(null);
  const [currentPartnerMood, setCurrentPartnerMood] = useState<MoodEmoji | null>(null);

  // Editor's song state
  const [editorSpotifyLink, setEditorSpotifyLink] = useState('');
  const [editorSongTitle, setEditorSongTitle] = useState('');
  const [isFetchingEditorSongDetails, setIsFetchingEditorSongDetails] = useState(false);
  const [editorSongDetailsError, setEditorSongDetailsError] = useState<string | null>(null);

  // Partner's song state
  const [partnerSpotifyLink, setPartnerSpotifyLink] = useState('');
  const [partnerSongTitle, setPartnerSongTitle] = useState('');
  const [isFetchingPartnerSongDetails, setIsFetchingPartnerSongDetails] = useState(false);
  const [partnerSongDetailsError, setPartnerSongDetailsError] = useState<string | null>(null);

  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    setNewEditorNoteText('');
    setNewPartnerNoteText('');
    setPromptForPartner(log?.promptForPartner || '');
    setPromptForEditor(log?.promptForEditor || '');
    setCurrentEditorMood((log?.moods?.editor as MoodEmoji) || null);
    setCurrentPartnerMood((log?.moods?.partner as MoodEmoji) || null);
    
    setEditorSpotifyLink(log?.songs?.editor?.link || '');
    setEditorSongTitle(log?.songs?.editor?.title || '');
    setPartnerSpotifyLink(log?.songs?.partner?.link || '');
    setPartnerSongTitle(log?.songs?.partner?.title || '');

    setSuggestedReplies([]);
    setErrorSuggestions(null);
    setEditorSongDetailsError(null);
    setIsFetchingEditorSongDetails(false);
    setPartnerSongDetailsError(null);
    setIsFetchingPartnerSongDetails(false);
  }, [log, selectedDate]);


  const handleEditorSave = async (e: FormEvent) => {
    e.preventDefault();
    const currentLogSnapshot: DailyLog = log || { editorNotes: [], partnerNotes: [], songs: {}, moods: {} };
    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      editorNotes: newEditorNoteText.trim()
        ? [...(currentLogSnapshot.editorNotes || []), newEditorNoteText]
        : (currentLogSnapshot.editorNotes || []),
      promptForPartner: promptForPartner.trim(),
      moods: {
        ...(currentLogSnapshot.moods),
        editor: currentEditorMood,
      },
      songs: {
        ...(currentLogSnapshot.songs),
        editor: editorSpotifyLink.trim() 
          ? { link: editorSpotifyLink.trim(), title: editorSongTitle.trim() } 
          : undefined,
      },
    };
    onSave(selectedDate, updatedLog);
    setNewEditorNoteText('');
  };

  const handlePartnerSave = async (e: FormEvent) => {
    e.preventDefault();
    const currentLogSnapshot: DailyLog = log || { editorNotes: [], partnerNotes: [], songs: {}, moods: {} };
    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      partnerNotes: newPartnerNoteText.trim() ? [...(currentLogSnapshot.partnerNotes || []), newPartnerNoteText] : (currentLogSnapshot.partnerNotes || []),
      promptForEditor: promptForEditor.trim(),
      moods: {
        ...(currentLogSnapshot.moods),
        partner: currentPartnerMood,
      },
      songs: {
        ...(currentLogSnapshot.songs),
        partner: partnerSpotifyLink.trim() 
          ? { link: partnerSpotifyLink.trim(), title: partnerSongTitle.trim() } 
          : undefined,
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
     const currentLogSnapshot: DailyLog = log || { editorNotes: [], partnerNotes: [] };
    const currentPartnerNotes = currentLogSnapshot.partnerNotes;

    if (!currentPartnerNotes || indexToDelete < 0 || indexToDelete >= currentPartnerNotes.length) {
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
  
  const handleFetchSongDetails = async (link: string, targetUser: 'editor' | 'partner') => {
    if (!link || !isValidSpotifyTrackUrl(link)) {
      const errorMsg = "Please enter a valid Spotify track or episode URL.";
      if (targetUser === 'editor') setEditorSongDetailsError(errorMsg);
      else setPartnerSongDetailsError(errorMsg);
      return;
    }

    if (targetUser === 'editor') {
      setIsFetchingEditorSongDetails(true);
      setEditorSongDetailsError(null);
    } else {
      setIsFetchingPartnerSongDetails(true);
      setPartnerSongDetailsError(null);
    }

    try {
      const result: ExtractSongDetailsOutput = await extractSongDetails({ spotifyUrl: link });
      if (targetUser === 'editor') setEditorSongTitle(result.songTitle);
      else setPartnerSongTitle(result.songTitle);
      toast({ title: "Song Details Fetched!", description: `Found title: ${result.songTitle}` });
    } catch (error: any) {
      const errorMsg = error.message || "Could not fetch song details. Please check the link or try again.";
      if (targetUser === 'editor') setEditorSongDetailsError(errorMsg);
      else setPartnerSongDetailsError(errorMsg);
      toast({ title: "Error Fetching Song Details", description: errorMsg, variant: "destructive" });
    } finally {
      if (targetUser === 'editor') setIsFetchingEditorSongDetails(false);
      else setIsFetchingPartnerSongDetails(false);
    }
  };


  const renderMoodSelector = (currentMood: MoodEmoji | null, onSelectMood: (mood: MoodEmoji) => void, label: string) => (
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

  const renderTheirMood = (mood: MoodEmoji | null | undefined, label: string) => {
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
  
  const renderSongDisplay = (song: SongEntry | null | undefined, userLabel: string) => {
    if (!song || !song.link) return null;
    return (
      <div>
        <Label className="text-muted-foreground font-semibold flex items-center"><Music2 className="w-4 h-4 mr-2 text-accent"/>{userLabel}'s Song for the Day:</Label>
        <Button variant="link" asChild className="p-0 h-auto">
          <a href={song.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block text-left">
            {song.title ? song.title : song.link}
          </a>
        </Button>
      </div>
    );
  };

  const renderSongInputSection = (
    link: string,
    setLink: (val: string) => void,
    title: string,
    setTitle: (val: string) => void,
    isFetching: boolean,
    error: string | null,
    fetchFn: () => void,
    userType: 'editor' | 'partner'
  ) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${userType}SpotifyLink`} className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Spotify Song/Episode Link</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`${userType}SpotifyLink`}
            type="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              if (userType === 'editor') setEditorSongDetailsError(null); else setPartnerSongDetailsError(null);
            }}
            onBlur={fetchFn}
            placeholder="https://open.spotify.com/track/..."
            className="flex-grow"
          />
          <Button
            type="button"
            onClick={fetchFn}
            disabled={isFetching || !isValidSpotifyTrackUrl(link)}
            variant="outline"
            size="icon"
            aria-label="Fetch song details"
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${userType}SongTitle`} className="flex items-center font-semibold"><Music2 className="w-4 h-4 mr-2 text-accent"/>Song/Episode Title</Label>
        <Input
          id={`${userType}SongTitle`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Sunflower (auto-filled from link)"
        />
      </div>
    </div>
  );


  const formattedDateDisplay = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (mode === 'reader') { // Partner's View
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">{formattedDateDisplay}</CardTitle>
          {(!log || (!log.editorNotes?.length && !log.songs?.editor?.link && !log.partnerNotes?.length && !log.promptForPartner && !log.promptForEditor && !log.moods?.editor && !log.moods?.partner && !log.songs?.partner?.link)) && (
             <CardDescription>No entries for this day yet. Be the first to leave a note or a prompt!</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {renderTheirMood(log?.moods?.editor as MoodEmoji | undefined, "Their Mood Today:")}
          {renderSongDisplay(log?.songs?.editor, "Their")}

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
          {renderSongDisplay(log?.songs?.partner, "Your")}


          <form onSubmit={handlePartnerSave} className="space-y-4 pt-6 border-t">
            {renderMoodSelector(currentPartnerMood, (mood) => setCurrentPartnerMood(mood), "Your Mood Today:")}
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
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="partner-song">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <div className="flex items-center">
                    <Music2 className="w-5 h-5 mr-2 text-accent"/> Add a song for the day for them?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  {renderSongInputSection(
                    partnerSpotifyLink, setPartnerSpotifyLink,
                    partnerSongTitle, setPartnerSongTitle,
                    isFetchingPartnerSongDetails, partnerSongDetailsError,
                    () => handleFetchSongDetails(partnerSpotifyLink, 'partner'),
                    'partner'
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

             <Button type="submit" className="w-full" disabled={!newPartnerNoteText.trim() && !promptForEditor.trim() && !currentPartnerMood && !partnerSpotifyLink.trim() && !partnerSongTitle.trim()}>
                <Save className="w-4 h-4 mr-2"/>
                Add My Note, Prompt, Mood & Song
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
          {renderMoodSelector(currentEditorMood, (mood) => setCurrentEditorMood(mood), "Your Mood Today:")}
          {renderTheirMood(log?.moods?.partner as MoodEmoji | undefined, "Their Mood Today:")}
          {renderSongDisplay(log?.songs?.partner, "Their")}


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

          {renderSongInputSection(
            editorSpotifyLink, setEditorSpotifyLink,
            editorSongTitle, setEditorSongTitle,
            isFetchingEditorSongDetails, editorSongDetailsError,
            () => handleFetchSongDetails(editorSpotifyLink, 'editor'),
            'editor'
          )}


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
          {onDelete && (log?.editorNotes?.length || log?.songs?.editor?.link || log?.partnerNotes?.length || log?.songs?.partner?.link || log?.promptForEditor || log?.promptForPartner || log?.moods?.editor || log?.moods?.partner) && (
             <Button type="button" variant="destructive" onClick={handleDeleteEntireEntry} className="w-full">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button 
            type="submit" 
            className="w-full whitespace-normal text-center h-auto" 
            disabled={
              !newEditorNoteText.trim() && 
              !editorSpotifyLink.trim() && 
              !editorSongTitle.trim() && 
              !promptForPartner.trim() && 
              !currentEditorMood &&
              // Disable if nothing new AND nothing existing that could be context for just updating mood/prompt/song
              !(log?.editorNotes?.length || log?.songs?.editor?.link || log?.promptForPartner || log?.moods?.editor)
            }
          >
            <PlusCircle className="w-4 h-4 mr-2"/>
            Add Note / Update Details, Prompt, Mood & Song
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
