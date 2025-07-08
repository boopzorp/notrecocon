
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { DailyLog, AppSettings, SongEntry, Event, AppGlobalConfig, BucketListItem } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, addDoc, query, where, deleteDoc, onSnapshot, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';

const USER_ROLE_LOCAL_STORAGE_KEY = 'notreCoconUserRole';
const FIRESTORE_SETTINGS_DOC_ID = 'appSettings';
const FIRESTORE_LOGS_COLLECTION_ID = 'dailyLogs';
const FIRESTORE_CONFIG_COLLECTION_ID = 'config';
const FIRESTORE_EVENTS_COLLECTION_ID = 'events';
const FIRESTORE_BUCKETLIST_COLLECTION_ID = 'bucketList';
const EVERGREEN_EVENT_ID = "dailyLifeEvent";


interface AppState {
  isInitialized: boolean;
  userRole: 'editor' | 'partner' | null;
  globalConfig: AppGlobalConfig;
  events: Event[];
  selectedEvent: Event | null;
  logs: Record<string, DailyLog>; 
  isLoadingLogs: boolean;
  isLoadingEvents: boolean;
  bucketList: BucketListItem[];
  isLoadingBucketList: boolean;
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
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' | null }
  | { type: 'LOAD_BUCKET_LIST_START' }
  | { type: 'LOAD_BUCKET_LIST_SUCCESS'; payload: BucketListItem[] }
  | { type: 'LOAD_BUCKET_LIST_FAILURE' };

const initialState: AppState = {
  isInitialized: false,
  userRole: null,
  globalConfig: { editorCode: null, partnerCode: null },
  events: [],
  selectedEvent: null,
  logs: {},
  isLoadingLogs: false,
  isLoadingEvents: false,
  bucketList: [],
  isLoadingBucketList: false,
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
    addBucketListItem: (text: string) => Promise<void>;
    toggleBucketListItem: (itemId: string, completed: boolean) => Promise<void>;
    deleteBucketListItem: (itemId: string) => Promise<void>;
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
      return {
        ...state,
        globalConfig: action.payload.globalConfig,
        events: sortEvents(action.payload.events),
        userRole: action.payload.userRole,
        isInitialized: true,
        isLoadingEvents: false,
      };
    case 'INITIALIZE_APP_FAILURE':
      return { ...state, isInitialized: true, isLoadingEvents: false, globalConfig: { editorCode: null, partnerCode: null } };
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
    case 'LOAD_BUCKET_LIST_START':
        return { ...state, isLoadingBucketList: true };
    case 'LOAD_BUCKET_LIST_SUCCESS':
        return { ...state, bucketList: action.payload.sort((a,b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1), isLoadingBucketList: false };
    case 'LOAD_BUCKET_LIST_FAILURE':
        return { ...state, isLoadingBucketList: false, bucketList: [] };
    default:
      return state;
  }
}

const ensureEvergreenEvent = async (): Promise<Event> => {
  const evergreenEventRef = doc(db, FIRESTORE_EVENTS_COLLECTION_ID, EVERGREEN_EVENT_ID);
  const evergreenEventSnap = await getDoc(evergreenEventRef);

  if (!evergreenEventSnap.exists()) {
    const newEvergreenEventData: Event = {
      id: EVERGREEN_EVENT_ID,
      name: "Daily Life",
      isEvergreen: true,
      startDate: null,
      endDate: null,
      createdBy: "system",
    };
    await setDoc(evergreenEventRef, newEvergreenEventData);
    return newEvergreenEventData;
  }
  const eventData = evergreenEventSnap.data();
   return { 
      id: evergreenEventSnap.id, 
      name: eventData?.name || "Daily Life", 
      isEvergreen: eventData?.isEvergreen === undefined ? true : eventData.isEvergreen, 
      startDate: eventData?.startDate || null,
      endDate: eventData?.endDate || null,
      createdBy: eventData?.createdBy || "system"
  } as Event;
};


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'INITIALIZE_APP_START' });
      try {
        const settingsDocRef = doc(db, FIRESTORE_CONFIG_COLLECTION_ID, FIRESTORE_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);
        let appSettingsFromDb: Partial<AppSettings> = {};

        if (settingsDocSnap.exists()) {
          appSettingsFromDb = settingsDocSnap.data() as AppSettings;
        }
        
        const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
        const eventsSnapshot = await getDocs(eventsCollectionRef);
        let fetchedEvents: Event[] = eventsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Event));
        
        const evergreenEvent = await ensureEvergreenEvent();

        if (!fetchedEvents.find(e => e.id === EVERGREEN_EVENT_ID)) {
            fetchedEvents.push(evergreenEvent);
        } else {
            fetchedEvents = fetchedEvents.map(e => e.id === EVERGREEN_EVENT_ID ? evergreenEvent : e);
        }

        const storedUserRole = localStorage.getItem(USER_ROLE_LOCAL_STORAGE_KEY) as 'editor' | 'partner' | null;
        
        const globalConfigData = {
          editorCode: appSettingsFromDb.editorCode || null,
          partnerCode: appSettingsFromDb.partnerCode || null,
        };

        dispatch({
          type: 'INITIALIZE_APP_SUCCESS',
          payload: {
            globalConfig: globalConfigData,
            events: fetchedEvents,
            userRole: storedUserRole,
          }
        });
      } catch (error: any) {
        console.error("[AppContext] CRITICAL ERROR during loadInitialData:", error, "Stack:", error.stack);
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
          const dateKey = logDoc.id.substring(state.selectedEvent!.id.length + 1);
          
          if (dateKey && dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
             const parsedDate = parseISO(dateKey);
             if (isValid(parsedDate)) {
                fetchedLogs[format(parsedDate, 'yyyy-MM-dd')] = {
                    ...logData,
                    eventId: state.selectedEvent!.id 
                };
             }
          }
        });
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: fetchedLogs });
      } catch (error) {
        console.error(`Failed to load logs for event ${state.selectedEvent.id}:`, error);
        dispatch({ type: 'LOAD_LOGS_FAILURE' });
      }
    };
    if (state.isInitialized && state.selectedEvent) { 
        fetchLogsForSelectedEvent();
    } else if (state.isInitialized && !state.selectedEvent) { 
        dispatch({ type: 'LOAD_LOGS_SUCCESS', payload: {} });
    }
  }, [state.selectedEvent, state.isInitialized]);

  // Real-time listener for Bucket List
  useEffect(() => {
    if (!state.isInitialized || !state.userRole) {
      dispatch({ type: 'LOAD_BUCKET_LIST_SUCCESS', payload: [] });
      return;
    }
  
    dispatch({ type: 'LOAD_BUCKET_LIST_START' });
    const bucketListQuery = query(collection(db, FIRESTORE_BUCKETLIST_COLLECTION_ID), orderBy('createdAt', 'desc'));
  
    const unsubscribe = onSnapshot(bucketListQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BucketListItem));
      dispatch({ type: 'LOAD_BUCKET_LIST_SUCCESS', payload: items });
    }, (error) => {
      console.error("Error fetching bucket list:", error);
      dispatch({ type: 'LOAD_BUCKET_LIST_FAILURE' });
    });
  
    return () => unsubscribe();
  }, [state.isInitialized, state.userRole]);


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
    if (state.userRole !== 'editor') return null;
    if (!eventData.startDate || !eventData.endDate) return null;
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
      console.error("Failed to add event to Firestore:", error);
      return null;
    }
  }, [state.userRole]);

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<Omit<Event, 'id' | 'createdBy'>>): Promise<boolean> => {
    if (state.userRole !== 'editor') return false;
    if (eventId === EVERGREEN_EVENT_ID && (eventData.hasOwnProperty('startDate') || eventData.hasOwnProperty('endDate') || eventData.hasOwnProperty('isEvergreen'))) return false;
    try {
      const eventDocRef = doc(db, FIRESTORE_EVENTS_COLLECTION_ID, eventId);
      const updateData: Partial<Event> = { ...eventData };
      if (eventData.startDate) updateData.startDate = format(parseISO(eventData.startDate), 'yyyy-MM-dd'); else updateData.startDate = null;
      if (eventData.endDate) updateData.endDate = format(parseISO(eventData.endDate), 'yyyy-MM-dd'); else updateData.endDate = null;
      if (eventData.name) updateData.name = eventData.name.trim();

      await setDoc(eventDocRef, updateData, { merge: true });
      
      const baseEvent = state.events.find(e => e.id === eventId);
      if (!baseEvent) return false; 
      const updatedEventFull: Event = { ...baseEvent, ...updateData };
      dispatch({ type: 'UPDATE_EVENT_SUCCESS', payload: updatedEventFull });
      return true;
    } catch (error) {
      console.error(`Failed to update event ${eventId}:`, error);
      return false;
    }
  }, [state.userRole, state.events]);

  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    if (state.userRole !== 'editor') return false;
    if (eventId === EVERGREEN_EVENT_ID) return false;
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
      console.error(`Failed to delete event ${eventId} and its logs:`, error);
      return false;
    }
  }, [state.userRole]);


  const upsertLog = useCallback(async (date: Date, logEntry: Omit<DailyLog, 'eventId'>) => {
    if (!state.selectedEvent) return;
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
      console.error(`Failed to save log '${logId}' to Firestore:`, error.message, error.stack);
    }
  }, [state.selectedEvent]);

  const getLog = useCallback((date: Date): DailyLog | undefined => {
    if (!state.selectedEvent) return undefined;
    const formattedDate = format(date, 'yyyy-MM-dd');
    return state.logs[formattedDate];
  }, [state.logs, state.selectedEvent]);

  const isEventSelected = useCallback((): boolean => {
    return !!state.selectedEvent;
  }, [state.selectedEvent]);

  const resetAllAppData = useCallback(async () => {
    if (state.userRole !== 'editor') return;
    try {
      const batch = writeBatch(db);
      const logsCollectionRef = collection(db, FIRESTORE_LOGS_COLLECTION_ID);
      const logsSnapshot = await getDocs(logsCollectionRef);
      logsSnapshot.docs.forEach((logDoc) => batch.delete(logDoc.ref));
      const eventsCollectionRef = collection(db, FIRESTORE_EVENTS_COLLECTION_ID);
      const eventsQuery = query(eventsCollectionRef, where("id", "!=", EVERGREEN_EVENT_ID)); 
      const eventsSnapshotToReset = await getDocs(eventsQuery);
      eventsSnapshotToReset.docs.forEach((eventDoc) => {
         if (eventDoc.id !== EVERGREEN_EVENT_ID) batch.delete(eventDoc.ref);
      });
      await batch.commit();
      const evergreenEvent = await ensureEvergreenEvent(); 
      dispatch({ type: 'RESET_DATA_STATE_SUCCESS', payload: { events: [evergreenEvent] } });
      selectEvent(null);
    } catch (error) {
      console.error("Failed to reset all app data in Firestore:", error);
    }
  }, [state.userRole, selectEvent]);

  const attemptLoginWithCode = useCallback((enteredCode: string): boolean => {
    if (!state.isInitialized) return false;
    const { editorCode, partnerCode } = state.globalConfig;
    if (!editorCode && !partnerCode && (editorCode !== null || partnerCode !== null)) return false;
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

  const addBucketListItem = useCallback(async (text: string) => {
    if (!state.userRole) return;
    try {
      await addDoc(collection(db, FIRESTORE_BUCKETLIST_COLLECTION_ID), {
        text,
        completed: false,
        createdAt: serverTimestamp(),
        createdBy: state.userRole,
      });
    } catch (error) {
      console.error("Error adding bucket list item:", error);
    }
  }, [state.userRole]);

  const toggleBucketListItem = useCallback(async (itemId: string, completed: boolean) => {
    try {
      const itemRef = doc(db, FIRESTORE_BUCKETLIST_COLLECTION_ID, itemId);
      await updateDoc(itemRef, { completed });
    } catch (error) {
      console.error("Error toggling bucket list item:", error);
    }
  }, []);

  const deleteBucketListItem = useCallback(async (itemId: string) => {
    if (state.userRole !== 'editor') return;
    try {
      await deleteDoc(doc(db, FIRESTORE_BUCKETLIST_COLLECTION_ID, itemId));
    } catch (error) {
      console.error("Error deleting bucket list item:", error);
    }
  }, [state.userRole]);


  return (
    <AppContext.Provider value={{ ...state, selectEvent, addEvent, updateEvent, deleteEvent, upsertLog, getLog, isEventSelected, resetAllAppData, setUserRole, attemptLoginWithCode, addBucketListItem, toggleBucketListItem, deleteBucketListItem }}>
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
