export interface DailyLog {
  note: string;
  spotifyLink: string;
  partnerNote?: string; // Added field for partner's notes
}

export interface AppSettings {
  internshipStart: string | null; // ISO string
  internshipEnd: string | null; // ISO string
  userRole?: 'editor' | 'partner'; // Added userRole
}

export interface AppData extends AppSettings {
  logs: Record<string, DailyLog>; // Key is 'YYYY-MM-DD'
}
