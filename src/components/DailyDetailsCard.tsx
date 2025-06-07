
"use client";

import type { FormEvent, ChangeEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DailyLog, PhotoEntry } from "@/lib/types";
import { Music2, Save, BookOpen, Lightbulb, Trash2, PenLine, Gift, MessageSquarePlus, MessagesSquare, PlusCircle, Search, Loader2, ImageUp, ImageOff, FileImage, UserCircle, Camera } from 'lucide-react';
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

interface PhotoState {
  selectedFile: File | null;
  previewUrl: string | null;
  currentUrl: string | null;
  dataAiHint: string;
  isUploading: boolean;
  uploadError: string | null;
}

const initialPhotoState: PhotoState = {
  selectedFile: null,
  previewUrl: null,
  currentUrl: null,
  dataAiHint: '',
  isUploading: false,
  uploadError: null,
};

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

  // Photo states for editor and partner
  const [editorPhotoState, setEditorPhotoState] = useState<PhotoState>(initialPhotoState);
  const [partnerPhotoState, setPartnerPhotoState] = useState<PhotoState>(initialPhotoState);

  const editorFileInputRef = useRef<HTMLInputElement>(null);
  const partnerFileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const formattedDateString = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    setNewEditorNoteText('');
    setSpotifyLink(log?.spotifyLink || '');
    setSongTitle(log?.songTitle || '');
    setNewPartnerNoteText('');
    setSuggestedReplies([]);
    setErrorSuggestions(null);
    setSongDetailsError(null);
    setIsFetchingSongDetails(false);

    setEditorPhotoState({
      ...initialPhotoState,
      currentUrl: log?.photos?.editor?.url || null,
      dataAiHint: log?.photos?.editor?.hint || '',
    });
    setPartnerPhotoState({
      ...initialPhotoState,
      currentUrl: log?.photos?.partner?.url || null,
      dataAiHint: log?.photos?.partner?.hint || '',
    });

    if (editorFileInputRef.current) editorFileInputRef.current.value = '';
    if (partnerFileInputRef.current) partnerFileInputRef.current.value = '';

  }, [log, selectedDate]);

  const handlePhotoFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    userType: 'editor' | 'partner'
  ) => {
    const file = event.target.files?.[0];
    const setPhotoState = userType === 'editor' ? setEditorPhotoState : setPartnerPhotoState;

    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setPhotoState(prev => ({ ...prev, uploadError: "Image is too large. Max 5MB allowed.", selectedFile: null, previewUrl: null }));
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setPhotoState(prev => ({ ...prev, uploadError: "Invalid file type. Only JPG, PNG, GIF, WEBP allowed.", selectedFile: null, previewUrl: null }));
        return;
      }
      setPhotoState(prev => ({
        ...prev,
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
        uploadError: null,
        currentUrl: null, // Clear existing photo if new one is selected
      }));
    }
  };

  const handleRemovePhoto = async (userType: 'editor' | 'partner', isPartOfSaveOrDelete: boolean = false): Promise<Partial<PhotoEntry> | null> => {
    const photoPath = `dailyPhotos/${formattedDateString}/${userType}_photo`;
    const currentLogPhoto = userType === 'editor' ? log?.photos?.editor : log?.photos?.partner;
    const photoState = userType === 'editor' ? editorPhotoState : partnerPhotoState;
    const setPhotoState = userType === 'editor' ? setEditorPhotoState : setPartnerPhotoState;
    const fileInputRef = userType === 'editor' ? editorFileInputRef : partnerFileInputRef;

    if (photoState.currentUrl || currentLogPhoto?.url) {
      try {
        const photoToDeleteRef = storageRef(storage, photoPath);
        await deleteObject(photoToDeleteRef);
        if (!isPartOfSaveOrDelete) {
          toast({ title: "Photo Removed", description: `The ${userType}'s photo has been removed.` });
        }
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error(`Error deleting ${userType}'s photo from storage:`, error);
        }
      }
    }
    
    setPhotoState(prev => ({ ...prev, selectedFile: null, previewUrl: null, currentUrl: null, dataAiHint: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!isPartOfSaveOrDelete) {
       const currentLogSnapshot = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [], photos: {} };
       const updatedPhotos = { ...currentLogSnapshot.photos };
       delete updatedPhotos[userType];

       const updatedLog: DailyLog = { ...currentLogSnapshot, photos: updatedPhotos };
       onSave(selectedDate, updatedLog);
    }
    return { url: '', hint: '' }; // Return cleared fields for save operation
  };

  const uploadPhoto = async (file: File, userType: 'editor' | 'partner', setPhotoState: React.Dispatch<React.SetStateAction<PhotoState>>): Promise<PhotoEntry | null> => {
    setPhotoState(prev => ({ ...prev, isUploading: true, uploadError: null }));
    const photoPath = `dailyPhotos/${formattedDateString}/${userType}_photo`;
    const fileRef = storageRef(storage, photoPath);
    
    try {
      const uploadTask = uploadBytesResumable(fileRef, file);
      await uploadTask;
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      setPhotoState(prev => ({ ...prev, isUploading: false, currentUrl: downloadURL, selectedFile: null, previewUrl: null }));
      toast({ title: `${userType === 'editor' ? "Your" : "Partner's"} Photo Uploaded!`, description: `The photo is now part of the entry.` });
      return { url: downloadURL, hint: (userType === 'editor' ? editorPhotoState.dataAiHint : partnerPhotoState.dataAiHint).trim() };
    } catch (error) {
      console.error(`Error uploading ${userType}'s photo:`, error);
      setPhotoState(prev => ({ ...prev, isUploading: false, uploadError: "Failed to upload photo. Please try again." }));
      return null;
    }
  };

  const handleEditorSaveNewNote = async (e: FormEvent) => {
    e.preventDefault();
    let newEditorPhotoEntry: PhotoEntry | undefined = log?.photos?.editor;

    if (editorPhotoState.selectedFile) {
      const uploaded = await uploadPhoto(editorPhotoState.selectedFile, 'editor', setEditorPhotoState);
      if (uploaded) newEditorPhotoEntry = uploaded;
      else return; // Upload failed
    } else if (editorPhotoState.currentUrl) { // If no new file, but currentUrl exists (and hint might have changed)
      newEditorPhotoEntry = { url: editorPhotoState.currentUrl, hint: editorPhotoState.dataAiHint.trim() };
    } else { // Photo was removed or never existed
      newEditorPhotoEntry = undefined;
    }
    
    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [], photos: {} };
    
    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      editorNotes: newEditorNoteText.trim()
        ? [...(currentLogSnapshot.editorNotes || []), newEditorNoteText]
        : (currentLogSnapshot.editorNotes || []),
      spotifyLink: spotifyLink.trim(),
      songTitle: songTitle.trim(),
      partnerNotes: currentLogSnapshot.partnerNotes || [],
      photos: {
        ...currentLogSnapshot.photos,
        editor: newEditorPhotoEntry,
      },
    };
    if (!updatedLog.photos?.editor) delete updatedLog.photos?.editor;
    if (updatedLog.photos && Object.keys(updatedLog.photos).length === 0) delete updatedLog.photos;

    onSave(selectedDate, updatedLog);
    setNewEditorNoteText('');
    // Photo state (currentUrl, dataAiHint) will be updated by useEffect when log re-fetches/updates
  };
  
  const handlePartnerSaveNewNote = async (e: FormEvent) => {
    e.preventDefault();
    let newPartnerPhotoEntry: PhotoEntry | undefined = log?.photos?.partner;

    if (partnerPhotoState.selectedFile) {
      const uploaded = await uploadPhoto(partnerPhotoState.selectedFile, 'partner', setPartnerPhotoState);
      if (uploaded) newPartnerPhotoEntry = uploaded;
      else return; // Upload failed
    } else if (partnerPhotoState.currentUrl) { // If no new file, but currentUrl exists (and hint might have changed)
      newPartnerPhotoEntry = { url: partnerPhotoState.currentUrl, hint: partnerPhotoState.dataAiHint.trim() };
    } else { // Photo was removed or never existed
      newPartnerPhotoEntry = undefined;
    }

    const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [], photos: {} };

    const updatedLog: DailyLog = {
      ...currentLogSnapshot,
      partnerNotes: newPartnerNoteText.trim() ? [...(currentLogSnapshot.partnerNotes || []), newPartnerNoteText] : (currentLogSnapshot.partnerNotes || []),
      photos: {
        ...currentLogSnapshot.photos,
        partner: newPartnerPhotoEntry,
      },
    };
    if (!updatedLog.photos?.partner) delete updatedLog.photos?.partner;
    if (updatedLog.photos && Object.keys(updatedLog.photos).length === 0) delete updatedLog.photos;

    onSave(selectedDate, updatedLog);
    setNewPartnerNoteText('');
  };

  const handleDeleteEntireEntry = async () => {
    if (onDelete) {
      let editorPhotoRemoved = false, partnerPhotoRemoved = false;
      if (log?.photos?.editor?.url) {
        await handleRemovePhoto('editor', true);
        editorPhotoRemoved = true;
      }
      if (log?.photos?.partner?.url) {
        await handleRemovePhoto('partner', true);
        partnerPhotoRemoved = true;
      }
      onDelete(selectedDate); // This will clear the entire log in context/Firestore
    }
  };

  const handleDeletePartnerNote = (indexToDelete: number) => {
     const currentLogSnapshot: DailyLog = log || { editorNotes: [], spotifyLink: '', songTitle: '', partnerNotes: [], photos: {} };
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

  const renderPhotoSection = (userType: 'editor' | 'partner', photoState: PhotoState, setPhotoState: React.Dispatch<React.SetStateAction<PhotoState>>, fileInputRef: React.RefObject<HTMLInputElement>, title: string, isEditable: boolean) => {
    const displayPhotoUrl = photoState.previewUrl || photoState.currentUrl;
    return (
      <div className="space-y-2 pt-4 border-t">
        <Label htmlFor={`${userType}PhotoUpload`} className="flex items-center font-semibold">
          {userType === 'editor' ? <Camera className="w-4 h-4 mr-2 text-accent"/> : <UserCircle className="w-4 h-4 mr-2 text-accent"/>}
          {title}
        </Label>
        {displayPhotoUrl ? (
          <div className="relative aspect-video w-full rounded-md overflow-hidden border shadow-sm mb-2">
            <Image src={displayPhotoUrl} alt={photoState.dataAiHint || `${userType}'s photo preview`} layout="fill" objectFit="cover" data-ai-hint={photoState.dataAiHint} />
          </div>
        ) : (
          isEditable && <p className="text-sm text-muted-foreground">No photo uploaded yet.</p>
        )}
        {isEditable && (
          <>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-grow">
                <ImageUp className="w-4 h-4 mr-2"/> {displayPhotoUrl ? "Change Photo" : "Upload Photo"}
              </Button>
              <input 
                type="file" 
                id={`${userType}PhotoUpload`} 
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp" 
                onChange={(e) => handlePhotoFileChange(e, userType)} 
                className="hidden" 
              />
              {(displayPhotoUrl || photoState.selectedFile) && (
                <Button type="button" variant="destructive" size="icon" onClick={() => handleRemovePhoto(userType, false)}>
                  <ImageOff className="w-4 h-4"/>
                  <span className="sr-only">Remove Photo</span>
                </Button>
              )}
            </div>
            {photoState.uploadError && <p className="text-sm text-destructive mt-1">{photoState.uploadError}</p>}
            {photoState.isUploading && <div className="flex items-center text-sm text-muted-foreground mt-1"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Uploading...</div>}
            
            <Label htmlFor={`${userType}PhotoDataAiHint`} className="text-sm font-medium">Photo Description (for AI & alt text)</Label>
            <Input
              id={`${userType}PhotoDataAiHint`}
              type="text"
              value={photoState.dataAiHint}
              onChange={(e) => setPhotoState(prev => ({ ...prev, dataAiHint: e.target.value }))}
              placeholder="e.g., beautiful sunset beach"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">Max 2 keywords, e.g., "cat playing".</p>
          </>
        )}
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
          {(!log || (!log.editorNotes?.length && !log.spotifyLink && !log.partnerNotes?.length && !log.photos?.editor?.url && !log.photos?.partner?.url)) && (
             <CardDescription>No entries for this day yet. Be the first to leave a note or photo!</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display Editor's Photo */}
          {log?.photos?.editor?.url && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="flex items-center font-semibold text-muted-foreground">
                <Camera className="w-4 h-4 mr-2 text-accent"/> Their Photo for the Day:
              </Label>
              <div className="relative aspect-video w-full rounded-md overflow-hidden border shadow-sm">
                <Image 
                  src={log.photos.editor.url} 
                  alt={log.photos.editor.hint || "Editor's photo of the day"} 
                  layout="fill" 
                  objectFit="cover" 
                  data-ai-hint={log.photos.editor.hint}
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
          
          {/* Partner's Photo Upload Section */}
          {renderPhotoSection('partner', partnerPhotoState, setPartnerPhotoState, partnerFileInputRef, "Your Photo for the Day", true)}

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
             <Button type="submit" className="w-full" disabled={partnerPhotoState.isUploading || (!newPartnerNoteText.trim() && !partnerPhotoState.selectedFile && !partnerPhotoState.currentUrl)}>
                {partnerPhotoState.isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                {partnerPhotoState.isUploading ? "Uploading..." : "Add My Note / Update Photo"}
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
          <CardTitle className="font-headline text-2xl text-primary">Log for {formattedDateDisplay}</CardTitle>
          <CardDescription>Share your thoughts, a song, your photo, and see notes & photo from your partner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Editor's Photo Upload Section */}
          {renderPhotoSection('editor', editorPhotoState, setEditorPhotoState, editorFileInputRef, "Your Photo of the Day", true)}

          {/* Display Partner's Photo (Read-only) */}
          {log?.photos?.partner?.url && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="flex items-center font-semibold text-muted-foreground">
                <UserCircle className="w-4 h-4 mr-2 text-accent"/> Partner's Photo for the Day:
              </Label>
              <div className="relative aspect-video w-full rounded-md overflow-hidden border shadow-sm">
                <Image 
                  src={log.photos.partner.url} 
                  alt={log.photos.partner.hint || "Partner's photo of the day"} 
                  layout="fill" 
                  objectFit="cover" 
                  data-ai-hint={log.photos.partner.hint}
                />
              </div>
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
          {onDelete && (log?.editorNotes?.length || log?.spotifyLink || log?.partnerNotes?.length || log?.songTitle || log?.photos?.editor?.url || log?.photos?.partner?.url ) && (
             <Button type="button" variant="destructive" onClick={handleDeleteEntireEntry} className="w-full">
                <Trash2 className="w-4 h-4 mr-2"/> Delete Entire Day's Entry
              </Button>
          )}
          <Button type="submit" className="w-full whitespace-normal text-center h-auto" disabled={editorPhotoState.isUploading}>
            {editorPhotoState.isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PlusCircle className="w-4 h-4 mr-2"/>}
            {editorPhotoState.isUploading ? "Uploading Photo..." : "Add Note / Update Details"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
