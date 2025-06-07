"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type { AppData, DailyLog } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';

const LOCAL_STORAGE_KEY = 'heartbeatsAwayData';

interface AppState extends AppData {
  isInitialized: boolean;
  userRole: 'editor' | 'partner'; // Made userRole non-optional in state
}

type Action =
  | { type: 'INITIALIZE'; payload: Partial<AppState> }
  | { type: 'SET_INTERNSHIP_DATES'; payload: { startDate: Date; endDate: Date } }
  | { type: 'UPSERT_LOG'; payload: { date: string; log: DailyLog } }
  | { type: 'RESET_DATA' }
  | { type: 'SET_USER_ROLE'; payload: 'editor' | 'partner' }; // Added SET_USER_ROLE action

const initialState: AppState = {
  internshipStart: null,
  internshipEnd: null,
  logs: {},
  isInitialized: false,
  userRole: 'editor', // Default role
};

const AppContext = createContext<
  (AppState & {
    setInternshipDates: (startDate: Date, endDate: Date) => void;
    upsertLog: (date: Date, log: DailyLog) => void;
    getLog: (date: Date) => DailyLog | undefined;
    isConfigured: () => boolean;
    resetData: () => void;
    setUserRole: (role: 'editor' | 'partner') => void; // Added setUserRole
  }) | undefined
>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...state, ...action.payload, userRole: action.payload.userRole || 'editor', isInitialized: true };
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
    case 'RESET_DATA':
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return { ...initialState, isInitialized: true, userRole: 'editor' }; // Ensure userRole resets to editor
    case 'SET_USER_ROLE': // Handle SET_USER_ROLE
      return { ...state, userRole: action.payload };
    default:
      return state;
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData) as Partial<AppData>;
        dispatch({ type: 'INITIALIZE', payload: { ...parsedData, userRole: parsedData.userRole || 'editor' } });
      } else {
        dispatch({ type: 'INITIALIZE', payload: { userRole: 'editor' } });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      dispatch({ type: 'INITIALIZE', payload: { userRole: 'editor' } });
    }
  }, []);

  useEffect(() => {
    if (state.isInitialized) {
      try {
        const dataToStore = {
          internshipStart: state.internshipStart,
          internshipEnd: state.internshipEnd,
          logs: state.logs,
          userRole: state.userRole, // Persist userRole
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
      } catch (error) {
        console.error("Failed to save data to localStorage", error);
      }
    }
  }, [state]);

  const setInternshipDates = useCallback((startDate: Date, endDate: Date) => {
    dispatch({ type: 'SET_INTERNSHIP_DATES', payload: { startDate, endDate } });
  }, []);

  const upsertLog = useCallback((date: Date, log: DailyLog) => {
    dispatch({ type: 'UPSERT_LOG', payload: { date: format(date, 'yyyy-MM-dd'), log } });
  }, []);

  const getLog = useCallback((date: Date): DailyLog | undefined => {
    return state.logs[format(date, 'yyyy-MM-dd')];
  }, [state.logs]);

  const isConfigured = useCallback((): boolean => {
    return !!state.internshipStart && !!state.internshipEnd && 
           isValid(parseISO(state.internshipStart)) && isValid(parseISO(state.internshipEnd));
  }, [state.internshipStart, state.internshipEnd]);
  
  const resetData = useCallback(() => {
    dispatch({ type: 'RESET_DATA' });
  }, []);

  const setUserRole = useCallback((role: 'editor' | 'partner') => { // Define setUserRole
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
