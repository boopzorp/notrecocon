export interface DailyLog {
  note: string;
  spotifyLink: string;
  partnerNotes?: string[]; // Changed from partnerNote: string to partnerNotes: string[]
}

export interface AppSettings {
  internshipStart: string | null; // ISO string
  internshipEnd: string | null; // ISO string
  userRole?: 'editor' | 'partner'; 
}

export interface AppData extends AppSettings {
  logs: Record<string, DailyLog>; // Key is 'YYYY-MM-DD'
}
