
export interface MoodEntry {
  editor?: string | null; 
  partner?: string | null; 
}

export interface SongEntry {
  link: string;
  title?: string;
}

export interface Event {
  id: string;
  name: string;
  startDate?: string | null; // YYYY-MM-DD - Optional for evergreen
  endDate?: string | null;   // YYYY-MM-DD - Optional for evergreen
  isEvergreen?: boolean;
  createdBy?: string; 
}

export interface DailyLog {
  eventId: string; 
  editorNotes?: string[];
  songs?: {
    editor?: SongEntry | null;
    partner?: SongEntry | null;
  };
  partnerNotes?: string[];
  promptForPartner?: string;
  promptForEditor?: string;
  moods?: MoodEntry;
}

export interface AppSettings {
  userRole?: 'editor' | 'partner';
  editorCode?: string;
  partnerCode?: string;
}

export interface AppGlobalConfig { 
  editorCode: string | null;
  partnerCode: string | null;
}

export interface BucketListItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: any; // Firestore Timestamp
  createdBy: 'editor' | 'partner' | null;
}
