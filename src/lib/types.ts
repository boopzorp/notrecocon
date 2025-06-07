
export interface MoodEntry {
  editor?: string | null; // emoji character, allow null
  partner?: string | null; // emoji character, allow null
}

export interface SongEntry {
  link: string;
  title?: string;
}

export interface DailyLog {
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
  eventName: string | null; // New: Name of the current event
  eventStartDate: string | null; // Renamed from internshipStart
  eventEndDate: string | null; // Renamed from internshipEnd
  userRole?: 'editor' | 'partner';
  editorCode?: string;
  partnerCode?: string;
}

export interface AppData extends AppSettings {
  logs: Record<string, DailyLog>; // Key is 'YYYY-MM-DD'
}
