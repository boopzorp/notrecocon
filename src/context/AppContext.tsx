
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { AppData, DailyLog, AppSettings } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

const USER_ROLE_LOCAL_STORAGE_KEY = 'notreCoconUserRole';
const FIRESTORE_SETTINGS_DOC_ID = 'appSettings';
const FIRESTORE_LOGS_COLLECTION_ID = 'dailyLogs';
const FIRESTORE_CONFIG_COLLECTION_ID = 'config';


interface AppState extends AppData {
  isInitialized: boolean;
  userRole: 'editor' | 'partner';
}

type Action =
  | { type: 'INITIALIZE_APP'; payload: { settings: Partial<AppSettings>; logs: Record<string, DailyLog>; userRole: 'editor' | 'partner' } }
  | { type: 'SET_INTERNSHIP_DATES'; payload: { startDate: Date; endDate: Date } }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA_STATE' }
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' };

const initialState: AppState = {
  internshipStart: null,
  internshipEnd: null,
  logs: {},
  isInitialized: false,
  userRole: 'editor',
};

const AppContext = createContext<
  (AppState & {
    setInternshipDates: (startDate: Date, endDate: Date) => Promise<void>;
    upsertLog: (date: Date, log: DailyLog) => Promise<void>;
    getLog: (date: Date) => DailyLog | undefined;
    isConfigured: () => boolean;
    resetData: () => Promise<void>;
    setUserRole: (role: 'editor' | 'partner') => void;
  }) | undefined
>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INITIALIZE_APP':
      return {
        ...state,
        internshipStart: action.payload.settings.internshipStart || null,
        internshipEnd: action.payload.settings.internshipEnd || null,
        logs: action.payload.logs,
        userRole: action.payload.userRole,
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
      const currentRole = state.isInitialized ? state.userRole : (localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' || 'editor');
      return { ...initialState, isInitialized: true, userRole: currentRole };
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
        
        dispatch({ type: 'INITIALIZE_APP', payload: { settings: appSettings, logs: fetchedLogs, userRole: storedUserRole || 'editor' } });
      } catch (error) {
        console.error("Failed to load data from Firestore or localStorage", error);
        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        dispatch({ type: 'INITIALIZE_APP', payload: { settings: {}, logs: {}, userRole: storedUserRole || 'editor' } });
      }
    };
    loadData();
  }, []);
  
  useEffect(() => {
    if (state.isInitialized) {
      try {
        localStorage.setItem(USER_ROLE_LOCAL_STORAGE_KEY, state.userRole);
      } catch (error) {
        console.error("Failed to save userRole to localStorage", error);
      }
    }
  }, [state.userRole, state.isInitialized]);


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
      const dataToSave: DailyLog = {
        editorNotes: logData.editorNotes || [],
        spotifyLink: typeof logData.spotifyLink === 'string' ? logData.spotifyLink : "",
        songTitle: typeof logData.songTitle === 'string' ? logData.songTitle : "",
        songArtist: typeof logData.songArtist === 'string' ? logData.songArtist : "",
        partnerNotes: logData.partnerNotes || [],
      };
      await setDoc(logDocRef, dataToSave);
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
      const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
      await deleteDoc(settingsDocRef);

      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      await batch.commit();
      
      localStorage.removeItem(USER_ROLE_LOCAL_STORAGE_KEY);

      dispatch({ type: 'RESET_DATA_STATE' });
    } catch (error) {
      console.error("Failed to reset data in Firestore:", error);
    }
  }, []);

  const setUserRole = useCallback((role: 'editor' | 'partner') => {
    dispatch({ type: 'SET_USER_ROLE', payload: role });
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setInternshipDates, upsertLog, getLog, isConfigured, resetData, setUserRole }}>
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
