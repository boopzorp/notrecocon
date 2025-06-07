
"use client";

import type { FormEvent, ChangeEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2, PenLine, Gift, MessageSquarePlus, MessagesSquare, PlusCircle, Search, Loader2, ImageUp, ImageOff, FileImage } from 'lucide-react';
import { generateSuggestedReplies, type SuggestedRepliesOutput } from '@/ai/flows/suggested-replies';
import { extractSongDetails, type ExtractSongDetailsOutput } from '@/ai/flows/extract-song-details-flow';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { format } from 'date-fns';

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
  const [songTitle, setSongTitle] = useState('');
  
  const [newPartnerNoteText, setNewPartnerNoteText] = useState('');

  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState<string | null>(null);

  const [isFetchingSongDetails, setIsFetchingSongDetails] = useState(false);
  const [songDetailsError, setSongDetailsError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [photoDataAiHint, setPhotoDataAiHint] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { toast } = useToast();

  useEffect(() => {
    setNewEditorNoteText('');
    setSpotifyLink(log?.spotifyLink || '');
    setSongTitle(log?.songTitle || '');
    setNewPartnerNoteText('');
    setSuggestedReplies([]);
    setErrorSuggestions(null);
    setSongDetailsError(null);
    setIsFetchingSongDetails(false);

    // Photo related state reset
    setSelectedFile(null);
    setPhotoPreviewUrl(null);
    setCurrentPhotoUrl(log?.photoUrl || null);
    setPhotoDataAiHint(log?.photoDataAiHint || '');
    setIsUploadingPhoto(false);
    setPhotoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

  }, [log, selectedDate]);

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setPhotoUploadError("Image is too large. Max 5MB allowed.");
        setSelectedFile(null);
        setPhotoPreviewUrl(null);
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setPhotoUploadError("Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.");
        setSelectedFile(null);
        setPhotoPreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
      setPhotoUploadError(null); // Clear previous error
      setCurrentPhotoUrl(null); // Clear existing photo if new one is selected
    }
  };

  const handleRemovePhoto = async (isRemovingFromSave: boolean = false) => {
    const photoPath = `dailyPhotos/${format(selectedDate, 'yyyy-MM-dd')}/photo_of_the_day`;
    if (currentPhotoUrl || log?.photoUrl) { // Check both current state and log
      try {
        const photoToDeleteRef = storageRef(storage, photoPath);
        await deleteObject(photoToDeleteRef);
        toast({ title: "Photo Removed", description: "The photo has been removed from storage." });
      } catch (error: any) {
        // If file not found, it's fine, maybe it was already deleted or path changed.
        if (error.code !== 'storage/object-not-found') {
          console.error("Error deleting photo from storage:", error);
          // Don't block UI for this, but log it.
        }
      }
    }
    
    setSelectedFile(null);
    setPhotoPreviewUrl(null);
    setCurrentPhotoUrl(null);
    setPhotoDataAiHint(''); // Also clear hint when photo is removed
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // If not part of a save operation, explicitly save the log with photoUrl cleared
    if (!isRemovingFromSave) {
       const currentLogSnapshot = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };
       const updatedLog: DailyLog = {
        ...currentLogSnapshot,
        photoUrl: '',
        photoDataAiHint: '',
      };
      onSave(selectedDate, updatedLog);
    }
    return { photoUrl: '', photoDataAiHint: '' }; // Return cleared fields for save operation
  };


  const handleEditorSaveNewNote = async (e: FormEvent) => {
    e.preventDefault();
    setIsUploadingPhoto(false);
    setPhotoUploadError(null);

    let uploadedPhotoUrl = currentPhotoUrl || log?.photoUrl || '';
    let finalPhotoDataAiHint = photoDataAiHint || log?.photoDataAiHint || '';


    if (selectedFile) {
      setIsUploadingPhoto(true);
      const photoPath = `dailyPhotos/${format(selectedDate, 'yyyy-MM-dd')}/photo_of_the_day`;
      const fileRef = storageRef(storage, photoPath);
      
      try {
        const uploadTask = uploadBytesResumable(fileRef, selectedFile);
        await uploadTask;
        uploadedPhotoUrl = await getDownloadURL(uploadTask.snapshot.ref);
        toast({ title: "Photo Uploaded!", description: "Your photo is now part of the entry." });
      } catch (error) {
        console.error("Error uploading photo:", error);
        setPhotoUploadError("Failed to upload photo. Please try again.");
        setIsUploadingPhoto(false);
        return;
      }
      setIsUploadingPhoto(false);
    }
    
    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };
    
    const updatedLog: DailyLog = {
      editorNotes: newEditorNoteText.trim()
        ? [...(currentLogSnapshot.editorNotes || []), newEditorNoteText]
        : (currentLogSnapshot.editorNotes || []),
      spotifyLink: spotifyLink.trim(),
      songTitle: songTitle.trim(),
      partnerNotes: currentLogSnapshot.partnerNotes || [],
      photoUrl: uploadedPhotoUrl,
      photoDataAiHint: finalPhotoDataAiHint.trim(),
    };

    onSave(selectedDate, updatedLog);
    setNewEditorNoteText('');
    setSelectedFile(null); // Clear selected file after successful save
    setPhotoPreviewUrl(null); // Clear preview
    // currentPhotoUrl will be updated by useEffect when log re-fetches
    // photoDataAiHint also updated by useEffect
  };
  
  const handlePartnerSaveNewNote = (e: FormEvent) => {
    e.preventDefault();
    if (!newPartnerNoteText.trim()) return;

    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [] };

    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      partnerNotes: [...(currentLogSnapshot.partnerNotes || []), newPartnerNoteText],
    };
    onSave(selectedDate, updatedLog);
    setNewPartnerNoteText('');
  };

  const handleDeleteEntireEntry = async () => {
    if (onDelete) {
      // If there's a photo, attempt to remove it from storage first
      if (log?.photoUrl || currentPhotoUrl) {
        await handleRemovePhoto(true); // Pass true to indicate it's part of save/delete
      }
      onDelete(selectedDate); // This will clear the entire log in context/Firestore
      // Local state resets are handled by useEffect when `log` becomes undefined
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


  const formattedDate = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (mode === 'reader') {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">{formattedDate}</CardTitle>
          {(!log || (!log.editorNotes?.length && !log.spotifyLink && !log.partnerNotes?.length && !log.photoUrl)) && (
             <CardDescription>No entries for this day yet. Be the first to leave a note!</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {log?.photoUrl && (
            <div className="my-4">
              <Label className="text-muted-foreground font-semibold flex items-center mb-2"><FileImage className="w-4 h-4 mr-2 text-accent"/> Photo for the Day:</Label>
              <div className="relative aspect-video w-full rounded-md overflow-hidden border shadow-sm">
                <Image 
                  src={log.photoUrl} 
                  alt={log.photoDataAiHint || "Photo of the day"} 
                  layout="fill" 
                  objectFit="cover" 
                  data-ai-hint={log.photoDataAiHint}
                />
              </div>
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
             <Button type="submit" className="w-full" disabled={!newPartnerNoteText.trim()}>
                <Save className="w-4 h-4 mr-2"/> Add My Note
              </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Editor Mode
  const displayPhotoUrl = photoPreviewUrl || currentPhotoUrl;

  return (
    <Card className="shadow-md">
      <form onSubmit={handleEditorSaveNewNote}>
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-primary">Log for {formattedDate}</CardTitle>
          <CardDescription>Share your thoughts, a song, a photo, and see notes from your partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo Upload Section */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="photoUpload" className="flex items-center font-semibold"><FileImage className="w-4 h-4 mr-2 text-accent"/>Photo of the Day</Label>
            {displayPhotoUrl && (
              <div className="relative aspect-video w-full rounded-md overflow-hidden border shadow-sm mb-2">
                <Image src={displayPhotoUrl} alt={photoDataAiHint || "Photo preview"} layout="fill" objectFit="cover" data-ai-hint={photoDataAiHint} />
              </div>
            )}
             <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-grow">
                <ImageUp className="w-4 h-4 mr-2"/> {displayPhotoUrl ? "Change Photo" : "Upload Photo"}
              </Button>
              <input 
                type="file" 
                id="photoUpload" 
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp" 
                onChange={handlePhotoFileChange} 
                className="hidden" 
              />
              {(displayPhotoUrl || selectedFile) && (
                <Button type="button" variant="destructive" size="icon" onClick={() => handleRemovePhoto(false)}>
                  <ImageOff className="w-4 h-4"/>
                  <span className="sr-only">Remove Photo</span>
                </Button>
              )}
            </div>
            {photoUploadError && <p className="text-sm text-destructive mt-1">{photoUploadError}</p>}
            {isUploadingPhoto && <div className="flex items-center text-sm text-muted-foreground mt-1"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Uploading...</div>}
            
            <Label htmlFor="photoDataAiHint" className="text-sm font-medium">Photo Description (for AI & alt text)</Label>
            <Input
              id="photoDataAiHint"
              type="text"
              value={photoDataAiHint}
              onChange={(e) => setPhotoDataAiHint(e.target.value)}
              placeholder="e.g., beautiful sunset beach"
              maxLength={50}
            />
             <p className="text-xs text-muted-foreground">Max 2 keywords, e.g., "cat playing".</p>
          </div>


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
          {onDelete && (log?.editorNotes?.length || log?.spotifyLink || log?.partnerNotes?.length || log?.songTitle || log?.photoUrl ) && (
             <Button type="button" variant="destructive" onClick={handleDeleteEntireEntry} className="w-full">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button type="submit" className="w-full whitespace-normal text-center h-auto" disabled={isUploadingPhoto}>
            {isUploadingPhoto ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PlusCircle className="w-4 h-4 mr-2"/>}
            {isUploadingPhoto ? "Uploading Photo..." : "Add Note / Update Details"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
