
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
const EVERGREEN_EVENT_ID = "___dailyLifeEvent___";


interface AppState {
  isInitialized: boolean;
  userRole: 'editor' | 'partner' | null;
  globalConfig: AppGlobalConfig;
  events: Event[];
  selectedEvent: Event | null;
  logs: Record<string, DailyLog>; 
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
  | { type: 'UPDATE_EVENT_SUCCESS'; payload: Event }
  | { type: 'DELETE_EVENT_SUCCESS'; payload: string }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA_STATE_SUCCESS'; payload: { events: Event[] } }
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
    addEvent: (eventData: Omit<Event, 'id' | 'createdBy' | 'isEvergreen'>) => Promise<string | null>;
    updateEvent: (eventId: string, eventData: Partial<Omit<Event, 'id' | 'createdBy'>>) => Promise<boolean>;
    deleteEvent: (eventId: string) => Promise<boolean>;
    upsertLog: (date: Date, log: Omit<DailyLog, 'eventId'>) => Promise<void>;
    getLog: (date: Date) => DailyLog | undefined;
    isEventSelected: () => boolean; 
    resetAllAppData: () => Promise<void>;
    setUserRole: (role: 'editor' | 'partner' | null) => void;
    attemptLoginWithCode: (code: string) => boolean;
  }) | undefined
>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => {
      if (a.isEvergreen && !b.isEvergreen) return -1;
      if (!a.isEvergreen && b.isEvergreen) return 1;
      if (a.startDate && b.startDate) {
        return parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime();
      }
      if (a.startDate && !b.startDate) return -1; 
      if (!a.startDate && b.startDate) return 1;
      return a.name.localeCompare(b.name); 
    });
  };

  switch (action.type) {
    case 'INITIALIZE_APP_START':
      return { ...state, isInitialized: false, isLoadingEvents: true };
    case 'INITIALIZE_APP_SUCCESS':
      console.log('[AppContextReducer] INITIALIZE_APP_SUCCESS with payload:', action.payload);
      return {
        ...state,
        globalConfig: action.payload.globalConfig,
        events: sortEvents(action.payload.events),
        userRole: action.payload.userRole,
        isInitialized: true,
        isLoadingEvents: false,
      };
    case 'INITIALIZE_APP_FAILURE':
      console.warn('[AppContextReducer] INITIALIZE_APP_FAILURE');
      return { ...state, isInitialized: true, isLoadingEvents: false, globalConfig: { editorCode: null, partnerCode: null } }; // Ensure globalConfig is reset on failure
    case 'SELECT_EVENT':
      return {
        ...state,
        selectedEvent: action.payload,
        logs: {}, 
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
        events: sortEvents([...state.events, action.payload]),
      };
    case 'UPDATE_EVENT_SUCCESS':
      return {
        ...state,
        events: sortEvents(state.events.map(event => event.id === action.payload.id ? { ...event, ...action.payload } : event)),
        selectedEvent: state.selectedEvent?.id === action.payload.id ? { ...state.selectedEvent, ...action.payload } : state.selectedEvent,
      };
    case 'DELETE_EVENT_SUCCESS':
      return {
        ...state,
        events: sortEvents(state.events.filter(event => event.id !== action.payload)),
        selectedEvent: state.selectedEvent?.id === action.payload ? null : state.selectedEvent,
        logs: state.selectedEvent?.id === action.payload ? {} : state.logs,
      };
    case 'UPSERT_LOG':
      if (!state.selectedEvent) return state; 
      return {
        ...state,
        logs: {
          ...state.logs,
          [action.payload.date]: action.payload.log,
        },
      };
    case 'RESET_DATA_STATE_SUCCESS':
      return {
        ...initialState, 
        globalConfig: state.globalConfig, 
        userRole: state.userRole, 
        isInitialized: true,
        events: sortEvents(action.payload.events), 
        selectedEvent: null,
        logs: {},
      };
    case 'SET_USER_ROLE':
      return { ...state, userRole: action.payload };
    default:
      return state;
  }
}

const ensureEvergreenEvent = async (): Promise<Event> => {
  console.log('[ensureEvergreenEvent] Starting.');
  const evergreenEventRef = doc(db, FIRESTORE_EVENTS_COLLECTION_ID, EVERGREEN_EVENT_ID);
  const evergreenEventSnap = await getDoc(evergreenEventRef);

  if (!evergreenEventSnap.exists()) {
    console.log('[ensureEvergreenEvent] Evergreen event does not exist, creating it.');
    const newEvergreenEventData: Event = {
      id: EVERGREEN_EVENT_ID,
      name: "Daily Life",
      isEvergreen: true,
      startDate: null,
      endDate: null,
      createdBy: "system",
    };
    await setDoc(evergreenEventRef, newEvergreenEventData);
    console.log("[ensureEvergreenEvent] Created default 'Daily Life' event in Firestore.");
    return newEvergreenEventData;
  }
  console.log('[ensureEvergreenEvent] Evergreen event exists, returning data.');
  const eventData = evergreenEventSnap.data();
   return { 
      id: evergreenEventSnap.id, 
      name: eventData?.name || "Daily Life (Fallback Name)", // Add fallback
      isEvergreen: eventData?.isEvergreen === undefined ? true : eventData.isEvergreen, // Add fallback
      startDate: eventData?.startDate || null,
      endDate: eventData?.endDate || null,
      createdBy: eventData?.createdBy || "system"
  } as Event;
};


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const loadInitialData = async () => {
      console.log('[AppContext] loadInitialData: START');
      dispatch({ type: 'INITIALIZE_APP_START' });
      try {
        console.log(`[AppContext] Attempting to load settings from: ${FIRESTORE_CONFIG_COLLECTION_ID}/${FIRESTORE_SETTINGS_DOC_ID}`);
        const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);
        let appSettingsFromDb: Partial<AppSettings> = {};
        console.log(`[AppContext] settingsDocSnap.exists() = ${settingsDocSnap.exists()}`);

        if (settingsDocSnap.exists()) {
          appSettingsFromDb = settingsDocSnap.data() as AppSettings;
          console.log('[AppContext] Raw data from settingsDocSnap.data():', settingsDocSnap.data());
          console.log('[AppContext] Parsed appSettingsFromDb:', appSettingsFromDb);
        } else {
          console.warn(`[AppContext] Firestore document at '${FIRESTORE_CONFIG_COLLECTION_ID}/${FIRESTORE_SETTINGS_DOC_ID}' does NOT exist. Access codes will be null.`);
        }

        console.log('[AppContext] Fetching all events...');
        const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        let fetchedEvents: Event[] = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Event));
        console.log('[AppContext] Initially fetched events (before evergreen check):', JSON.parse(JSON.stringify(fetchedEvents)));
        
        console.log('[AppContext] Calling ensureEvergreenEvent...');
        const evergreenEvent = await ensureEvergreenEvent();
        console.log('[AppContext] ensureEvergreenEvent returned:', JSON.parse(JSON.stringify(evergreenEvent)));

        if (!fetchedEvents.find(e => e.id === EVERGREEN_EVENT_ID)) {
            console.log('[AppContext] Evergreen event not in fetched list, adding it.');
            fetchedEvents.push(evergreenEvent);
        } else {
            console.log('[AppContext] Evergreen event found in fetched list, ensuring canonical version is used.');
            fetchedEvents = fetchedEvents.map(e => e.id === EVERGREEN_EVENT_ID ? evergreenEvent : e);
        }
        console.log('[AppContext] Final fetched and processed events (including evergreen):', JSON.parse(JSON.stringify(fetchedEvents)));

        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        console.log('[AppContext] Stored user role from localStorage:', storedUserRole);
        
        const globalConfigData = {
          editorCode: appSettingsFromDb.editorCode || null,
          partnerCode: appSettingsFromDb.partnerCode || null,
        };
        console.log('[AppContext] Global config to be dispatched:', globalConfigData);

        dispatch({
          type: 'INITIALIZE_APP_SUCCESS',
          payload: {
            globalConfig: globalConfigData,
            events: fetchedEvents,
            userRole: storedUserRole,
          }
        });
        console.log('[AppContext] loadInitialData: SUCCESS - Dispatched INITIALIZE_APP_SUCCESS');
      } catch (error: any) {
        console.error("[AppContext] CRITICAL ERROR during loadInitialData:", error, "Stack:", error.stack);
        dispatch({ type: 'INITIALIZE_APP_FAILURE' });
        console.warn('[AppContext] loadInitialData: FAILURE - Dispatched INITIALIZE_APP_FAILURE');
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
      console.warn(`[AppContext] Event with ID '${eventId}' not found in current events list. Not selecting.`);
      dispatch({ type: 'SELECT_EVENT', payload: null }); 
    }
  }, [state.events]);

  useEffect(() => {
    const fetchLogsForSelectedEvent = async () => {
      if (!state.selectedEvent) {
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: {} });
        return;
      }
      dispatch({ type: 'LOAD_LOGS_START' });
      try {
        const logsQuery = query(collection(db, FIRESTORE_LOGS_COLLECTION_ID), where("eventId", "==", state.selectedEvent.id));
        const logsSnapshot = await getDocs(logsQuery);
        const fetchedLogs: Record<string, DailyLog> = {};
        logsSnapshot.forEach((logDoc) => {
          const logData = logDoc.data() as Omit<DailyLog, 'eventId'>; 
          const dateKey = logDoc.id.startsWith(state.selectedEvent!.id) ? logDoc.id.substring(state.selectedEvent!.id.length + 1) : logDoc.id.split('_')[0];
          
          if (dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fetchedLogs[format(parseISO(dateKey), 'yyyy-MM-dd')] = {
                ...logData,
                eventId: state.selectedEvent!.id 
            };
          } else {
            console.warn(`[AppContext] Invalid date format in log ID '${logDoc.id}'. Skipping log.`);
          }
        });
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: fetchedLogs });
      } catch (error) {
        console.error(`[AppContext] Failed to load logs for event ${state.selectedEvent.id}:`, error);
        dispatch({ type: 'LOAD_LOGS_FAILURE' });
      }
    };
    if (state.isInitialized && state.selectedEvent) { 
        fetchLogsForSelectedEvent();
    } else if (state.isInitialized && !state.selectedEvent) { 
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: {} });
    }
  }, [state.selectedEvent, state.isInitialized]);


  const setUserRole = useCallback((role: 'editor' | 'partner' | null) => {
    if (role) {
      localStorage.setItem(USER_ROLE_LOCAL_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(USER_ROLE_LOCAL_STORAGE_KEY);
      selectEvent(null); 
    }
    dispatch({ type: 'SET_USER_ROLE', payload: role });
  }, [selectEvent]);

  const addEvent = useCallback(async (eventData: Omit<Event, 'id' | 'createdBy' | 'isEvergreen'>): Promise<string | null> => {
    if (state.userRole !== 'editor') {
      console.error("[AppContext] Only editor can add events.");
      return null;
    }
    if (!eventData.startDate || !eventData.endDate) {
      console.error("[AppContext] Start date and end date are required for new events.");
      return null;
    }
    try {
      const newEventDocRef = await addDoc(collection(db, FIRESTORE_EVENTS_COLLECTION_ID), {
        ...eventData,
        createdBy: state.userRole, 
        name: eventData.name.trim(),
        startDate: format(parseISO(eventData.startDate), 'yyyy-MM-dd'), 
        endDate: format(parseISO(eventData.endDate), 'yyyy-MM-dd'),  
        isEvergreen: false,   
      });
      const newEvent: Event = { 
        id: newEventDocRef.id, 
        name: eventData.name.trim(),
        startDate: format(parseISO(eventData.startDate), 'yyyy-MM-dd'),
        endDate: format(parseISO(eventData.endDate), 'yyyy-MM-dd'),
        isEvergreen: false,
        createdBy: state.userRole 
      };
      dispatch({ type: 'ADD_EVENT_SUCCESS', payload: newEvent });
      return newEventDocRef.id;
    } catch (error) {
      console.error("[AppContext] Failed to add event to Firestore:", error);
      return null;
    }
  }, [state.userRole]);

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<Omit<Event, 'id' | 'createdBy'>>): Promise<boolean> => {
    if (state.userRole !== 'editor') {
      console.error("[AppContext] Only editor can update events.");
      return false;
    }
    if (eventId === EVERGREEN_EVENT_ID && (eventData.hasOwnProperty('startDate') || eventData.hasOwnProperty('endDate') || eventData.hasOwnProperty('isEvergreen'))) {
        console.error("[AppContext] Start/end dates and evergreen status of 'Daily Life' event cannot be modified.");
        return false;
    }
    try {
      const eventDocRef = doc(db, FIRESTORE_EVENTS_COLLECTION_ID, eventId);
      const updateData: Partial<Event> = { ...eventData };
      if (eventData.startDate) updateData.startDate = format(parseISO(eventData.startDate), 'yyyy-MM-dd'); else updateData.startDate = null;
      if (eventData.endDate) updateData.endDate = format(parseISO(eventData.endDate), 'yyyy-MM-dd'); else updateData.endDate = null;
      if (eventData.name) updateData.name = eventData.name.trim();

      await setDoc(eventDocRef, updateData, { merge: true });
      
      const updatedEventFull: Event = { 
        ...(state.events.find(e => e.id === eventId) as Event), 
        ...updateData 
      };

      dispatch({ type: 'UPDATE_EVENT_SUCCESS', payload: updatedEventFull });
      return true;
    } catch (error) {
      console.error(`[AppContext] Failed to update event ${eventId}:`, error);
      return false;
    }
  }, [state.userRole, state.events]);

  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    if (state.userRole !== 'editor') {
      console.error("[AppContext] Only editor can delete events.");
      return false;
    }
    if (eventId === EVERGREEN_EVENT_ID) {
        console.error("[AppContext] The 'Daily Life' event cannot be deleted.");
        return false;
    }
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, FIRESTORE_EVENTS_COLLECTION_ID, eventId));
      const logsQuery = query(collection(db, FIRESTORE_LOGS_COLLECTION_ID), where("eventId", "==", eventId));
      const logsSnapshot = await getDocs(logsQuery);
      logsSnapshot.docs.forEach((logDoc) => batch.delete(logDoc.ref));
      
      await batch.commit();
      dispatch({ type: 'DELETE_EVENT_SUCCESS', payload: eventId });
      return true;
    } catch (error) {
      console.error(`[AppContext] Failed to delete event ${eventId} and its logs:`, error);
      return false;
    }
  }, [state.userRole]);


  const upsertLog = useCallback(async (date: Date, logEntry: Omit<DailyLog, 'eventId'>) => {
    if (!state.selectedEvent) {
      console.error("[AppContext] Cannot save log: No event selected.");
      return;
    }
    const formattedDate = format(date, 'yyyy-MM-dd');
    const logIdPrefix = state.selectedEvent.id; 
    const logId = `${logIdPrefix}_${formattedDate}`; 

    try {
      const logDocRef = doc(db, FIRESTORE_LOGS_COLLECTION_ID, logId);
      
      const fullLogData: DailyLog = {
        ...logEntry,
        eventId: state.selectedEvent.id,
        editorNotes: logEntry.editorNotes || [],
        partnerNotes: logEntry.partnerNotes || [],
        promptForPartner: logEntry.promptForPartner || "",
        promptForEditor: logEntry.promptForEditor || "",
        moods: {
          editor: logEntry.moods?.editor === undefined ? null : logEntry.moods.editor,
          partner: logEntry.moods?.partner === undefined ? null : logEntry.moods.partner,
        },
        songs: {
          editor: logEntry.songs?.editor || null,
          partner: logEntry.songs?.partner || null,
        }
      };
      
      await setDoc(logDocRef, fullLogData, { merge: true });
      dispatch({ type: 'UPSERT_LOG', payload: { date: formattedDate, log: fullLogData } });
    } catch (error: any) {
      console.error(`[AppContext] Failed to save log '${logId}' to Firestore:`, error.message, error.stack);
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
    console.log("[AppContext] Attempting to reset all app data (events and logs)...");
    try {
      const batch = writeBatch(db);

      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      logsSnapshot.docs.forEach((logDoc) => batch.delete(logDoc.ref));
      console.log(`[AppContext] Marked ${logsSnapshot.size} logs for deletion.`);

      const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
      const eventsQuery = query(eventsCollectionRef, where("id", "!=", EVERGREEN_EVENT_ID)); 
      const eventsSnapshotToReset = await getDocs(eventsQuery);
      eventsSnapshotToReset.docs.forEach((eventDoc) => {
         if (eventDoc.id !== EVERGREEN_EVENT_ID) { 
            batch.delete(eventDoc.ref);
         }
      });
      console.log(`[AppContext] Marked ${eventsSnapshotToReset.size} non-evergreen events for deletion.`);
      
      await batch.commit();
      console.log("[AppContext] Successfully reset non-evergreen events and all logs in Firestore.");
      
      const evergreenEvent = await ensureEvergreenEvent(); 
      
      dispatch({ type: 'RESET_DATA_STATE_SUCCESS', payload: { events: [evergreenEvent] } });
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
    
    console.log(`[AppContext] Attempting login. Provided code: "${enteredCode}". Configured editorCode: "${editorCode}", partnerCode: "${partnerCode}"`);

    if (!editorCode && !partnerCode) {
      console.warn("[AppContext] Editor/Partner codes not found in loaded global config. Check Firestore 'config/appSettings'. This could be due to the document not existing, or the fields being missing/null.");
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
    <AppContext.Provider value={{ ...state, selectEvent, addEvent, updateEvent, deleteEvent, upsertLog, getLog, isEventSelected, resetAllAppData, setUserRole, attemptLoginWithCode }}>
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

