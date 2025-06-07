
export interface PhotoEntry {
  url: string;
  hint: string;
}

export interface DailyLog {
  editorNotes?: string[];
  spotifyLink: string;
  songTitle?: string;
  partnerNotes?: string[];
  photos?: {
    editor?: PhotoEntry;
    partner?: PhotoEntry;
  };
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
