
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { AppData, DailyLog, AppSettings } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db, app as firebaseApp } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

const USER_ROLE_LOCAL_STORAGE_KEY = 'notreCoconUserRole';
const FIRESTORE_SETTINGS_DOC_ID = 'appSettings';
const FIRESTORE_LOGS_COLLECTION_ID = 'dailyLogs';
const FIRESTORE_CONFIG_COLLECTION_ID = 'config';


interface AppState extends AppData {
  isInitialized: boolean;
  userRole: 'editor' | 'partner' | null; 
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
  userRole: null, 
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
      return {
        ...initialState,
        isInitialized: true,
        userRole: null, 
        editorCode: state.editorCode, 
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
        console.error("[AppContext] Failed to load data from Firestore or localStorage", error);
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
      const dataToSave: DailyLog = {
        editorNotes: logData.editorNotes || [],
        spotifyLink: typeof logData.spotifyLink === 'string' ? logData.spotifyLink : "",
        songTitle: typeof logData.songTitle === 'string' ? logData.songTitle : "",
        partnerNotes: logData.partnerNotes || [],
      };
      
      await setDoc(logDocRef, dataToSave, { merge: true });
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
      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      await batch.commit();

      dispatch({ type: 'RESET_DATA_STATE' });
    } catch (error) {
      console.error("Failed to reset log data in Firestore:", error);
    }
  }, []);

  const attemptLoginWithCode = useCallback((enteredCode: string): boolean => {
    if (!state.isInitialized) {
      console.warn("[AppContext] Attempted login before app context initialized.");
      return false;
    }
    
    if (!state.editorCode && !state.partnerCode) {
      console.warn("[AppContext] Editor/Partner codes not configured in Firestore settings or not loaded into app state. This is based on what was read from Firestore.");
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
