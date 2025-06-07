
export interface MoodEntry {
  editor?: string; // emoji character
  partner?: string; // emoji character
}

export interface DailyLog {
  editorNotes?: string[];
  spotifyLink: string;
  songTitle?: string;
  partnerNotes?: string[];
  promptForPartner?: string; // Prompt from editor to partner
  promptForEditor?: string;   // Prompt from partner to editor
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
