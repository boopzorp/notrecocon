export interface DailyLog {
  editorNotes?: string[]; // Changed from note: string
  spotifyLink: string;
  partnerNotes?: string[];
}

export interface AppSettings {
  internshipStart: string | null; // ISO string
  internshipEnd: string | null; // ISO string
  userRole?: 'editor' | 'partner'; 
}

export interface AppData extends AppSettings {
  logs: Record<string, DailyLog>; // Key is 'YYYY-MM-DD'
}
