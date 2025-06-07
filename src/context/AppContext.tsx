
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { AppData, DailyLog, AppSettings, SongEntry } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

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
  | { type: 'SET_EVENT_DETAILS'; payload: { eventName: string | null; startDate: Date; endDate: Date } }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA_STATE' }
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' | null };

const initialState: AppState = {
  eventName: null,
  eventStartDate: null,
  eventEndDate: null,
  logs: {},
  isInitialized: false,
  userRole: null,
  editorCode: null,
  partnerCode: null,
};

const AppContext = createContext<
  (AppState & {
    setEventDetails: (eventName: string | null, startDate: Date, endDate: Date) => Promise<void>;
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
      console.log("[AppContext] Initializing with settings:", action.payload.settings);
      console.log("[AppContext] Initializing with userRole:", action.payload.userRole);
      return {
        ...state,
        eventName: action.payload.settings.eventName || null,
        eventStartDate: action.payload.settings.eventStartDate || null,
        eventEndDate: action.payload.settings.eventEndDate || null,
        editorCode: action.payload.settings.editorCode || null,
        partnerCode: action.payload.settings.partnerCode || null,
        logs: action.payload.logs,
        userRole: action.payload.userRole,
        isInitialized: true,
      };
    case 'SET_EVENT_DETAILS':
      return {
        ...state,
        eventName: action.payload.eventName,
        eventStartDate: format(action.payload.startDate, 'yyyy-MM-dd'),
        eventEndDate: format(action.payload.endDate, 'yyyy-MM-dd'),
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
        const settingsDocPath = `${FIRESTORE_CONFIG_COLLECTION_ID}/${FIRESTORE_SETTINGS_DOC_ID}`;
        const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);

        let appSettings: Partial<AppSettings> = {};
        if (settingsDocSnap.exists()) {
          appSettings = settingsDocSnap.data() as AppSettings;
          console.log("[AppContext] Loaded appSettings from Firestore:", appSettings);
        } else {
          console.warn(`[AppContext] appSettings document does not exist at path: ${settingsDocPath}. Ensure it's created with editorCode and partnerCode.`);
        }

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


  const setEventDetails = useCallback(async (eventName: string | null, startDate: Date, endDate: Date) => {
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    try {
      const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { eventName: eventName || "", eventStartDate: formattedStartDate, eventEndDate: formattedEndDate }, { merge: true });
      dispatch({ type: 'SET_EVENT_DETAILS', payload: { eventName, startDate, endDate } });
    } catch (error) {
      console.error("Failed to save event details to Firestore:", error);
    }
  }, []);

  const upsertLog = useCallback(async (date: Date, logData: DailyLog) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    try {
      const logDocRef = doc(db, FIRESTORE_LOGS_COLLECTION_ID, formattedDate);

      const editorSong: SongEntry | undefined = (logData.songs?.editor?.link)
        ? { link: logData.songs.editor.link, title: logData.songs.editor.title || "" }
        : undefined;
      const partnerSong: SongEntry | undefined = (logData.songs?.partner?.link)
        ? { link: logData.songs.partner.link, title: logData.songs.partner.title || "" }
        : undefined;

      const dataToSave: DailyLog = {
        editorNotes: logData.editorNotes || [],
        partnerNotes: logData.partnerNotes || [],
        promptForPartner: logData.promptForPartner || "",
        promptForEditor: logData.promptForEditor || "",
        moods: {
          editor: logData.moods?.editor || null,
          partner: logData.moods?.partner || null,
        },
        ...( (editorSong || partnerSong) && {
            songs: {
              ...(editorSong && { editor: editorSong }),
              ...(partnerSong && { partner: partnerSong }),
            }
          }
        )
      };
      
      await setDoc(logDocRef, dataToSave, { merge: true });
      dispatch({ type: 'UPSERT_LOG', payload: { date: formattedDate, log: dataToSave } });
    } catch (error: any) {
      console.error("Failed to save log to Firestore:", error.message, error.stack);
    }
  }, []);

  const getLog = useCallback((date: Date): DailyLog | undefined => {
    return state.logs[format(date, 'yyyy-MM-dd')];
  }, [state.logs]);

  const isConfigured = useCallback((): boolean => {
    return !!state.eventStartDate && !!state.eventEndDate &&
           isValid(parseISO(state.eventStartDate)) && isValid(parseISO(state.eventEndDate));
  }, [state.eventStartDate, state.eventEndDate]);

  const resetData = useCallback(async () => {
    try {
      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { eventName: null, eventStartDate: null, eventEndDate: null }, { merge: true });

      await batch.commit();
      dispatch({ type: 'RESET_DATA_STATE' });
    } catch (error) {
      console.error("Failed to reset log data in Firestore:", error);
    }
  }, []);

  const attemptLoginWithCode = useCallback((enteredCode: string): boolean => {
    if (!state.isInitialized) {
      console.warn("[AppContext] Attempted login before app context initialized or settings loaded.");
      return false;
    }

    if (!state.editorCode && !state.partnerCode) {
      console.warn("[AppContext] Editor/Partner codes not found in loaded app settings. Check Firestore 'config/appSettings'.");
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
    <AppContext.Provider value={{ ...state, setEventDetails, upsertLog, getLog, isConfigured, resetData, setUserRole, attemptLoginWithCode }}>
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
