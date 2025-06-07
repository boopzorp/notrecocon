
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
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdBy?: string; // Optional: 'editor' or user ID
}

export interface DailyLog {
  eventId: string; // Link to the Event
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
  // eventName, eventStartDate, eventEndDate are removed
  userRole?: 'editor' | 'partner';
  editorCode?: string;
  partnerCode?: string;
}

// AppData is less relevant now as global event details are removed.
// Context will hold events list and selectedEvent directly.
export interface AppGlobalConfig { // Renamed from AppData for clarity
  editorCode: string | null;
  partnerCode: string | null;
}
