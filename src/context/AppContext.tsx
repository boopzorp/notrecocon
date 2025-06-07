
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { DailyLog, AppSettings, SongEntry, Event, AppGlobalConfig } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, addDoc, query, where, deleteDoc } from 'firebase/firestore';

const USER_ROLE_LOCAL_STORAGE_KEY = 'notreCoconUserRole';
const FIRESTORE_SETTINGS_DOC_ID = 'appSettings';
const FIRESTORE_LOGS_COLLECTION_ID = 'dailyLogs';
const FIRESTORE_CONFIG_COLLECTION_ID = 'config';
const FIRESTORE_EVENTS_COLLECTION_ID = 'events';


interface AppState {
  isInitialized: boolean;
  userRole: 'editor' | 'partner' | null;
  globalConfig: AppGlobalConfig;
  events: Event[];
  selectedEvent: Event | null;
  logs: Record<string, DailyLog>; // Logs for the selectedEvent, keyed by 'YYYY-MM-DD'
  isLoadingLogs: boolean;
  isLoadingEvents: boolean;
}

type Action =
  | { type: 'INITIALIZE_APP_START' }
  | { type: 'INITIALIZE_APP_SUCCESS'; payload: { globalConfig: AppGlobalConfig; events: Event[]; userRole: 'editor' | 'partner' | null } }
  | { type: 'INITIALIZE_APP_FAILURE' }
  | { type: 'SELECT_EVENT'; payload: Event | null }
  | { type: 'LOAD_LOGS_START' }
  | { type: 'LOAD_LOGS_SUCCESS'; payload: Record<string, DailyLog> }
  | { type: 'LOAD_LOGS_FAILURE' }
  | { type: 'ADD_EVENT_SUCCESS'; payload: Event }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA_STATE_SUCCESS' }
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' | null };

const initialState: AppState = {
  isInitialized: false,
  userRole: null,
  globalConfig: { editorCode: null, partnerCode: null },
  events: [],
  selectedEvent: null,
  logs: {},
  isLoadingLogs: false,
  isLoadingEvents: false,
};

const AppContext = createContext<
  (AppState & {
    selectEvent: (eventId: string | null) => void;
    addEvent: (eventData: Omit<Event, 'id' | 'createdBy'>) => Promise<string | null>;
    upsertLog: (date: Date, log: Omit<DailyLog, 'eventId'>) => Promise<void>;
    getLog: (date: Date) => DailyLog | undefined;
    isEventSelected: () => boolean;
    resetAllAppData: () => Promise<void>;
    setUserRole: (role: 'editor' | 'partner' | null) => void;
    attemptLoginWithCode: (code: string) => boolean;
  }) | undefined
>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INITIALIZE_APP_START':
      return { ...state, isInitialized: false, isLoadingEvents: true };
    case 'INITIALIZE_APP_SUCCESS':
      return {
        ...state,
        globalConfig: action.payload.globalConfig,
        events: action.payload.events,
        userRole: action.payload.userRole,
        isInitialized: true,
        isLoadingEvents: false,
      };
    case 'INITIALIZE_APP_FAILURE':
      return { ...state, isInitialized: true, isLoadingEvents: false }; // Still initialized, but with defaults/empty
    case 'SELECT_EVENT':
      return {
        ...state,
        selectedEvent: action.payload,
        logs: {}, // Clear logs when event changes, will be re-fetched
      };
    case 'LOAD_LOGS_START':
      return { ...state, isLoadingLogs: true };
    case 'LOAD_LOGS_SUCCESS':
      return { ...state, logs: action.payload, isLoadingLogs: false };
    case 'LOAD_LOGS_FAILURE':
      return { ...state, isLoadingLogs: false, logs: {} };
    case 'ADD_EVENT_SUCCESS':
      return {
        ...state,
        events: [...state.events, action.payload],
      };
    case 'UPSERT_LOG':
      if (!state.selectedEvent) return state; // Should not happen if UI guards correctly
      return {
        ...state,
        logs: {
          ...state.logs,
          [action.payload.date]: action.payload.log,
        },
      };
    case 'RESET_DATA_STATE_SUCCESS':
      return {
        ...initialState, // Resets to initial, including clearing codes if they were part of initial
        globalConfig: state.globalConfig, // Keep existing codes
        userRole: state.userRole, // Keep existing role locally, will be cleared on logout if needed
        isInitialized: true,
        events: [],
        selectedEvent: null,
        logs: {},
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
    const loadInitialData = async () => {
      dispatch({ type: 'INITIALIZE_APP_START' });
      try {
        const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);
        let appSettings: Partial<AppSettings> = {};
        if (settingsDocSnap.exists()) {
          appSettings = settingsDocSnap.data() as AppSettings;
        } else {
          console.warn(`[AppContext] appSettings document does not exist at path: ${FIRESTORE_CONFIG_COLLECTION_ID}/${FIRESTORE_SETTINGS_DOC_ID}. Using defaults.`);
        }

        const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        const fetchedEvents: Event[] = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Event));
        fetchedEvents.sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()); // Sort newest first

        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        
        dispatch({
          type: 'INITIALIZE_APP_SUCCESS',
          payload: {
            globalConfig: {
              editorCode: appSettings.editorCode || null,
              partnerCode: appSettings.partnerCode || null,
            },
            events: fetchedEvents,
            userRole: storedUserRole,
          }
        });
      } catch (error) {
        console.error("[AppContext] Failed to load initial data:", error);
        dispatch({ type: 'INITIALIZE_APP_FAILURE' });
      }
    };
    loadInitialData();
  }, []);

  const selectEvent = useCallback((eventId: string | null) => {
    if (!eventId) {
      dispatch({ type: 'SELECT_EVENT', payload: null });
      return;
    }
    const eventToSelect = state.events.find(e => e.id === eventId);
    if (eventToSelect) {
      dispatch({ type: 'SELECT_EVENT', payload: eventToSelect });
    } else {
      dispatch({ type: 'SELECT_EVENT', payload: null }); // Event not found
    }
  }, [state.events]);

  useEffect(() => {
    const fetchLogsForSelectedEvent = async () => {
      if (!state.selectedEvent) {
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: {} }); // Clear logs if no event selected
        return;
      }
      dispatch({ type: 'LOAD_LOGS_START' });
      try {
        const logsQuery = query(collection(db, FIRESTORE_LOGS_COLLECTION_ID), where("eventId", "==", state.selectedEvent.id));
        const logsSnapshot = await getDocs(logsQuery);
        const fetchedLogs: Record<string, DailyLog> = {};
        logsSnapshot.forEach((logDoc) => {
          // The log ID in Firestore is YYYY-MM-DD, use this as key
          fetchedLogs[logDoc.id] = logDoc.data() as DailyLog;
        });
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: fetchedLogs });
      } catch (error) {
        console.error(`[AppContext] Failed to load logs for event ${state.selectedEvent.id}:`, error);
        dispatch({ type: 'LOAD_LOGS_FAILURE' });
      }
    };
    fetchLogsForSelectedEvent();
  }, [state.selectedEvent]);


  const setUserRole = useCallback((role: 'editor' | 'partner' | null) => {
    if (role) {
      localStorage.setItem(USER_ROLE_LOCAL_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(USER_ROLE_LOCAL_STORAGE_KEY);
      selectEvent(null); // Clear selected event on logout
    }
    dispatch({ type: 'SET_USER_ROLE', payload: role });
  }, [selectEvent]);

  const addEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdBy'>): Promise<string | null> => {
    if (state.userRole !== 'editor') {
      console.error("[AppContext] Only editor can add events.");
      return null;
    }
    try {
      const newEventDocRef = await addDoc(collection(db, FIRESTORE_EVENTS_COLLECTION_ID), {
        ...eventData,
        createdBy: state.userRole, // Or a more specific user ID if you have one
        startDate: format(parseISO(eventData.startDate), 'yyyy-MM-dd'), // Ensure format
        endDate: format(parseISO(eventData.endDate), 'yyyy-MM-dd'),     // Ensure format
      });
      const newEvent: Event = { id: newEventDocRef.id, ...eventData, createdBy: state.userRole };
      dispatch({ type: 'ADD_EVENT_SUCCESS', payload: newEvent });
      return newEventDocRef.id;
    } catch (error) {
      console.error("[AppContext] Failed to add event to Firestore:", error);
      return null;
    }
  }, [state.userRole]);

  const upsertLog = useCallback(async (date: Date, logEntry: Omit<DailyLog, 'eventId'>) => {
    if (!state.selectedEvent) {
      console.error("[AppContext] Cannot save log: No event selected.");
      return;
    }
    const formattedDate = format(date, 'yyyy-MM-dd');
    try {
      const logDocRef = doc(db, FIRESTORE_LOGS_COLLECTION_ID, formattedDate + "_" + state.selectedEvent.id); // Composite ID
      
      const fullLogData: DailyLog = {
        ...logEntry,
        eventId: state.selectedEvent.id,
        editorNotes: logEntry.editorNotes || [],
        partnerNotes: logEntry.partnerNotes || [],
        promptForPartner: logEntry.promptForPartner || "",
        promptForEditor: logEntry.promptForEditor || "",
        moods: {
          editor: logEntry.moods?.editor || null,
          partner: logEntry.moods?.partner || null,
        },
        songs: {
          editor: logEntry.songs?.editor || null,
          partner: logEntry.songs?.partner || null,
        }
      };
      
      // Firestore document ID will be YYYY-MM-DD for easy querying by date within an event's logs
      // We might need to change this if logs from different events on the same date could clash.
      // For now, assuming logs are fetched per event, the date key in the 'logs' state object is fine.
      // The Firestore document ID should be unique. A composite key like `YYYY-MM-DD_eventId` is safer.
      // Let's stick to storing logs in the `logs` state object keyed by 'YYYY-MM-DD' for simplicity in `getLog`.
      // The Firestore write will use the composite key.
      await setDoc(doc(db, FIRESTORE_LOGS_COLLECTION_ID, `${formattedDate}_${state.selectedEvent.id}`), fullLogData, { merge: true });

      // Update local state, keying by date for UI consistency
      dispatch({ type: 'UPSERT_LOG', payload: { date: formattedDate, log: fullLogData } });
    } catch (error: any) {
      console.error("[AppContext] Failed to save log to Firestore:", error.message, error.stack);
    }
  }, [state.selectedEvent]);

  const getLog = useCallback((date: Date): DailyLog | undefined => {
    if (!state.selectedEvent) return undefined;
    return state.logs[format(date, 'yyyy-MM-dd')];
  }, [state.logs, state.selectedEvent]);

  const isEventSelected = useCallback((): boolean => {
    return !!state.selectedEvent;
  }, [state.selectedEvent]);

  const resetAllAppData = useCallback(async () => {
    if (state.userRole !== 'editor') {
        console.error("Unauthorized: Only editor can reset all app data.");
        return;
    }
    try {
      const batch = writeBatch(db);

      // Delete all logs
      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      logsSnapshot.docs.forEach((logDoc) => batch.delete(logDoc.ref));

      // Delete all events
      const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
      const eventsSnapshot = await getDocs(eventsCollectionRef);
      eventsSnapshot.docs.forEach((eventDoc) => batch.delete(eventDoc.ref));
      
      // Note: Global config (access codes) are NOT reset here.
      // If you wanted to reset them, you'd update the config/appSettings doc.
      // For now, we just clear event-related data.

      await batch.commit();
      dispatch({ type: 'RESET_DATA_STATE_SUCCESS' });
      // Optionally, clear selected event if any was selected before reset
      selectEvent(null);

    } catch (error) {
      console.error("[AppContext] Failed to reset all app data in Firestore:", error);
    }
  }, [state.userRole, selectEvent]);

  const attemptLoginWithCode = useCallback((enteredCode: string): boolean => {
    if (!state.isInitialized) {
      console.warn("[AppContext] Attempted login before app context initialized or global config loaded.");
      return false;
    }
    const { editorCode, partnerCode } = state.globalConfig;

    if (!editorCode && !partnerCode) {
      console.warn("[AppContext] Editor/Partner codes not found in loaded global config. Check Firestore 'config/appSettings'.");
      return false;
    }

    if (editorCode && enteredCode === editorCode) {
      setUserRole('editor');
      return true;
    }
    if (partnerCode && enteredCode === partnerCode) {
      setUserRole('partner');
      return true;
    }
    return false;
  }, [state.isInitialized, state.globalConfig, setUserRole]);

  return (
    <AppContext.Provider value={{ ...state, selectEvent, addEvent, upsertLog, getLog, isEventSelected, resetAllAppData, setUserRole, attemptLoginWithCode }}>
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
