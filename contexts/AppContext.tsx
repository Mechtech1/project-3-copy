import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { useEffect } from 'react';
import { Vehicle, RepairTask, RepairSession, VoiceLog, OverlayPack } from '@/types';
import { UserVehicle } from '@/services/vehicleProfileService';
import { saveRepairSession, saveVoiceLog, getRepairHistory } from '@/services/sessionService';

interface AppState {
  vehicle: Vehicle | null;
  selectedVehicle: UserVehicle | null;
  availableRepairs: RepairTask[];
  currentSession: RepairSession | null;
  preparedRepairTask: RepairTask | null;
  preparedOverlayPack: OverlayPack | null;
  repairHistory: RepairSession[];
  isLoading: boolean;
  voiceTranscript: VoiceLog[];
  cameraActive: boolean;
}

type AppAction =
  | { type: 'SET_VEHICLE'; payload: Vehicle }
  | { type: 'SET_VEHICLE'; payload: Vehicle | null }
  | { type: 'SET_SELECTED_VEHICLE'; payload: UserVehicle | null }
  | { type: 'SET_AVAILABLE_REPAIRS'; payload: RepairTask[] }
  | { type: 'START_REPAIR_SESSION'; payload: RepairSession }
  | { type: 'SET_PREPARED_REPAIR'; payload: { repairTask: RepairTask; overlayPack: OverlayPack | null } }
  | { type: 'CLEAR_PREPARED_REPAIR' }
  | { type: 'UPDATE_SESSION_STEP'; payload: number }
  | { type: 'PAUSE_SESSION' }
  | { type: 'RESUME_SESSION' }
  | { type: 'END_SESSION' }
  | { type: 'ADD_VOICE_LOG'; payload: VoiceLog }
  | { type: 'SET_CAMERA_ACTIVE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_HISTORY'; payload: RepairSession[] }
  | { type: 'SAVE_SESSION_TO_DB'; payload: RepairSession }
  | { type: 'DELETE_SESSION'; payload: string };

const initialState: AppState = {
  vehicle: null,
  selectedVehicle: null,
  availableRepairs: [],
  currentSession: null,
  preparedRepairTask: null,
  preparedOverlayPack: null,
  repairHistory: [],
  isLoading: false,
  voiceTranscript: [],
  cameraActive: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VEHICLE':
      return { ...state, vehicle: action.payload };
    case 'SET_SELECTED_VEHICLE':
      return { ...state, selectedVehicle: action.payload };
    case 'SET_AVAILABLE_REPAIRS':
      return { ...state, availableRepairs: action.payload };
    case 'START_REPAIR_SESSION':
      return { ...state, currentSession: action.payload, cameraActive: true };
    case 'SET_PREPARED_REPAIR':
      return { 
        ...state, 
        preparedRepairTask: action.payload.repairTask,
        preparedOverlayPack: action.payload.overlayPack
      };
    case 'CLEAR_PREPARED_REPAIR':
      return { 
        ...state, 
        preparedRepairTask: null,
        preparedOverlayPack: null
      };
    case 'UPDATE_SESSION_STEP':
      if (!state.currentSession) return state;
      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          currentStepIndex: action.payload,
          stepsCompleted: action.payload,
        },
      };
    case 'PAUSE_SESSION':
      if (!state.currentSession) return state;
      return {
        ...state,
        currentSession: { ...state.currentSession, status: 'paused' },
        cameraActive: false,
      };
    case 'RESUME_SESSION':
      if (!state.currentSession) return state;
      return {
        ...state,
        currentSession: { ...state.currentSession, status: 'in_progress' },
        cameraActive: true,
      };
    case 'END_SESSION':
      if (!state.currentSession) return state;
      const completedSession = {
        ...state.currentSession,
        status: 'completed' as const,
        endTime: new Date().toISOString(),
      };
      
      return {
        ...state,
        currentSession: null,
        preparedRepairTask: null,
        preparedOverlayPack: null,
        repairHistory: [completedSession, ...state.repairHistory],
        cameraActive: false,
        voiceTranscript: [],
      };
    case 'ADD_VOICE_LOG':
      const updatedSession = state.currentSession ? {
        ...state.currentSession,
        voiceTranscript: [...state.currentSession.voiceTranscript, action.payload]
      } : null;
      
      return {
        ...state,
        voiceTranscript: [...state.voiceTranscript, action.payload],
        currentSession: updatedSession,
      };
    case 'SET_CAMERA_ACTIVE':
      return { ...state, cameraActive: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOAD_HISTORY':
      return { ...state, repairHistory: action.payload };
    case 'SAVE_SESSION_TO_DB':
      return state;
    case 'DELETE_SESSION':
      return {
        ...state,
        repairHistory: state.repairHistory.filter(session => session.id !== action.payload),
      };
    case 'DELETE_SESSION':
      return {
        ...state,
        repairHistory: state.repairHistory.filter(session => session.id !== action.payload),
      };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Handle database saves as side effects
  useEffect(() => {
    if (state.currentSession) {
      saveRepairSession(state.currentSession).catch((error) => {
        console.error('Failed to save repair session:', error);
      });
    }
  }, [state.currentSession]);

  // Handle voice log saves
  useEffect(() => {
    if (state.voiceTranscript.length > 0 && state.currentSession) {
      const latestLog = state.voiceTranscript[state.voiceTranscript.length - 1];
      saveVoiceLog(state.currentSession.id, latestLog).catch((error) => {
        console.error('Failed to save voice log:', error);
      });
    }
  }, [state.voiceTranscript, state.currentSession]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}