
export interface MoodEntry {
  editor?: string | null; // emoji character, allow null
  partner?: string | null; // emoji character, allow null
}

// NEW: Song entry structure
export interface SongEntry {
  link: string;
  title?: string;
}

export interface DailyLog {
  editorNotes?: string[];
  songs?: { // Optional top-level songs object
    editor?: SongEntry | null; // Optional editor song, allow null
    partner?: SongEntry | null; // Optional partner song, allow null
  };
  partnerNotes?: string[];
  promptForPartner?: string;
  promptForEditor?: string;
  moods?: MoodEntry;
}

export interface AppSettings {
  internshipStart: string | null; // ISO string
  internshipEnd: string | null; // ISO string
  userRole?: 'editor' | 'partner';
  editorCode?: string;
  partnerCode?: string;
}

export interface AppData extends AppSettings {
  logs: Record<string, DailyLog>; // Key is 'YYYY-MM-DD'
}
