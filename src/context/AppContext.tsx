
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { AppData, DailyLog, AppSettings, PhotoEntry } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

const USER_ROLE_LOCAL_STORAGE_KEY = 'notreCoconUserRole';
const FIRESTORE_SETTINGS_DOC_ID = 'appSettings';
const FIRESTORE_LOGS_COLLECTION_ID = 'dailyLogs';
const FIRESTORE_CONFIG_COLLECTION_ID = 'config';


interface AppState extends AppData {
  isInitialized: boolean;
  userRole: 'editor' | 'partner' | null; // Allow null for initial state before login
  editorCode: string | null;
  partnerCode: string | null;
}

type Action =
  | { type: 'INITIALIZE_APP'; payload: { settings: Partial<AppSettings>; logs: Record<string, DailyLog>; userRole: 'editor' | 'partner' | null } }
  | { type: 'SET_INTERNSHIP_DATES'; payload: { startDate: Date; endDate: Date } }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA_STATE' }
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' | null };

const initialState: AppState = {
  internshipStart: null,
  internshipEnd: null,
  logs: {},
  isInitialized: false,
  userRole: null, // Initially null
  editorCode: null,
  partnerCode: null,
};

const AppContext = createContext<
  (AppState & {
    setInternshipDates: (startDate: Date, endDate: Date) => Promise<void>;
    upsertLog: (date: Date, log: DailyLog) => Promise<void>;
    getLog: (date: Date) => DailyLog | undefined;
    isConfigured: () => boolean;
    resetData: () => Promise<void>;
    setUserRole: (role: 'editor' | 'partner' | null) => void;
    attemptLoginWithCode: (code: string) => boolean;
  }) | undefined
>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INITIALIZE_APP':
      return {
        ...state,
        internshipStart: action.payload.settings.internshipStart || null,
        internshipEnd: action.payload.settings.internshipEnd || null,
        editorCode: action.payload.settings.editorCode || null,
        partnerCode: action.payload.settings.partnerCode || null,
        logs: action.payload.logs,
        userRole: action.payload.userRole, // Persisted role or null
        isInitialized: true,
      };
    case 'SET_INTERNSHIP_DATES':
      return {
        ...state,
        internshipStart: format(action.payload.startDate, 'yyyy-MM-dd'),
        internshipEnd: format(action.payload.endDate, 'yyyy-MM-dd'),
      };
    case 'UPSERT_LOG':
      return {
        ...state,
        logs: {
          ...state.logs,
          [action.payload.date]: action.payload.log,
        },
      };
    case 'RESET_DATA_STATE':
      // Keep codes if they were loaded, but reset role
      return { 
        ...initialState, 
        isInitialized: true, 
        userRole: null, // Reset role, codes will be re-fetched or remain if already in state from init
        editorCode: state.editorCode, // Preserve loaded codes
        partnerCode: state.partnerCode,
      };
    case 'SET_USER_ROLE':
      return { ...state, userRole: action.payload };
    default:
      return state;
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const loadData = async () => {
      try {
        const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);
        const appSettings: Partial<AppSettings> = settingsDocSnap.exists() ? (settingsDocSnap.data() as AppSettings) : {};

        const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
        const logsSnapshot = await getDocs(logsCollectionRef);
        const fetchedLogs: Record<string, DailyLog> = {};
        logsSnapshot.forEach((logDoc) => {
          fetchedLogs[logDoc.id] = logDoc.data() as DailyLog;
        });

        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        
        dispatch({ 
          type: 'INITIALIZE_APP', 
          payload: { 
            settings: appSettings, 
            logs: fetchedLogs, 
            userRole: storedUserRole 
          } 
        });
      } catch (error) {
        console.error("Failed to load data from Firestore or localStorage", error);
        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        dispatch({ type: 'INITIALIZE_APP', payload: { settings: {}, logs: {}, userRole: storedUserRole } });
      }
    };
    loadData();
  }, []);
  
  const setUserRole = useCallback((role: 'editor' | 'partner' | null) => {
    if (role) {
      localStorage.setItem(USER_ROLE_LOCAL_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(USER_ROLE_LOCAL_STORAGE_KEY);
    }
    dispatch({ type: 'SET_USER_ROLE', payload: role });
  }, []);


  const setInternshipDates = useCallback(async (startDate: Date, endDate: Date) => {
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    try {
      const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { internshipStart: formattedStartDate, internshipEnd: formattedEndDate }, { merge: true });
      dispatch({ type: 'SET_INTERNSHIP_DATES', payload: { startDate, endDate } });
    } catch (error) {
      console.error("Failed to save internship dates to Firestore:", error);
    }
  }, []);

  const upsertLog = useCallback(async (date: Date, logData: DailyLog) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    try {
      const logDocRef = doc(db, FIRESTORE_LOGS_COLLECTION_ID, formattedDate);
      // Ensure all fields are present, defaulting if necessary
      const dataToSave: DailyLog = {
        editorNotes: logData.editorNotes || [],
        spotifyLink: typeof logData.spotifyLink === 'string' ? logData.spotifyLink : "",
        songTitle: typeof logData.songTitle === 'string' ? logData.songTitle : "",
        partnerNotes: logData.partnerNotes || [],
        photos: { // Ensure photos object and its potential sub-objects are handled
          editor: logData.photos?.editor ? { 
            url: typeof logData.photos.editor.url === 'string' ? logData.photos.editor.url : "",
            hint: typeof logData.photos.editor.hint === 'string' ? logData.photos.editor.hint : "",
          } : undefined,
          partner: logData.photos?.partner ? {
            url: typeof logData.photos.partner.url === 'string' ? logData.photos.partner.url : "",
            hint: typeof logData.photos.partner.hint === 'string' ? logData.photos.partner.hint : "",
          } : undefined,
        },
      };
       // Clean up photos object: if editor or partner is undefined, don't save them
      if (!dataToSave.photos?.editor) delete dataToSave.photos?.editor;
      if (!dataToSave.photos?.partner) delete dataToSave.photos?.partner;
      if (dataToSave.photos && Object.keys(dataToSave.photos).length === 0) {
        delete dataToSave.photos; // Delete the photos object if it's empty
      }

      await setDoc(logDocRef, dataToSave, { merge: true }); // Using merge: true to be safe with partial updates
      dispatch({ type: 'UPSERT_LOG', payload: { date: formattedDate, log: dataToSave } });
    } catch (error) {
      console.error("Failed to save log to Firestore:", error);
    }
  }, []);

  const getLog = useCallback((date: Date): DailyLog | undefined => {
    return state.logs[format(date, 'yyyy-MM-dd')];
  }, [state.logs]);

  const isConfigured = useCallback((): boolean => {
    return !!state.internshipStart && !!state.internshipEnd &&
           isValid(parseISO(state.internshipStart)) && isValid(parseISO(state.internshipEnd));
  }, [state.internshipStart, state.internshipEnd]);
  
  const resetData = useCallback(async () => {
    try {
      // Keep appSettings (including codes) but clear logs
      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      // Also delete photos from storage - this requires listing files, which is complex
      // For now, we'll just clear Firestore. Photos in storage would become orphaned.
      // A more robust solution would involve a Firebase Function to clean up orphaned storage.
      await batch.commit();
      
      dispatch({ type: 'RESET_DATA_STATE' }); 
    } catch (error) {
      console.error("Failed to reset log data in Firestore:", error);
    }
  }, []);

  const attemptLoginWithCode = useCallback((enteredCode: string): boolean => {
    if (!state.isInitialized) {
      console.warn("Attempted login before app context initialized.");
      return false;
    }
    if (!state.editorCode && !state.partnerCode) {
      console.warn("Editor/Partner codes not configured in Firestore settings.");
      return false;
    }

    if (state.editorCode && enteredCode === state.editorCode) {
      setUserRole('editor');
      return true;
    }
    if (state.partnerCode && enteredCode === state.partnerCode) {
      setUserRole('partner');
      return true;
    }
    return false;
  }, [state.isInitialized, state.editorCode, state.partnerCode, setUserRole]);


  return (
    <AppContext.Provider value={{ ...state, setInternshipDates, upsertLog, getLog, isConfigured, resetData, setUserRole, attemptLoginWithCode }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
