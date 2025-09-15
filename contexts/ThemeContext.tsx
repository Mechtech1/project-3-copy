import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  notificationsEnabled: boolean;
}

type ThemeAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_NOTIFICATIONS'; payload: boolean }
  | { type: 'LOAD_PREFERENCES'; payload: { theme: Theme; notifications: boolean } };

const initialState: ThemeState = {
  theme: 'system',
  isDark: false,
  notificationsEnabled: true,
};

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'SET_THEME':
      return { 
        ...state, 
        theme: action.payload,
        isDark: action.payload === 'dark' || (action.payload === 'system' && state.isDark)
      };
    case 'SET_NOTIFICATIONS':
      return { ...state, notificationsEnabled: action.payload };
    case 'LOAD_PREFERENCES':
      return {
        ...state,
        theme: action.payload.theme,
        notificationsEnabled: action.payload.notifications,
        isDark: action.payload.theme === 'dark'
      };
    default:
      return state;
  }
}

const ThemeContext = createContext<{
  state: ThemeState;
  dispatch: React.Dispatch<ThemeAction>;
  colors: any;
} | null>(null);

const lightColors = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#EA580C',
  error: '#DC2626',
  border: '#E5E7EB',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
};

const darkColors = {
  background: '#111827',
  surface: '#1F2937',
  card: '#1F2937',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#374151',
  tabBar: '#1F2937',
  tabBarBorder: '#374151',
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Load saved preferences on app start
  useEffect(() => {
    loadPreferences();
  }, []);

  // Save preferences when they change
  useEffect(() => {
    savePreferences();
  }, [state.theme, state.notificationsEnabled]);

  const loadPreferences = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      const savedNotifications = await AsyncStorage.getItem('notifications');
      
      dispatch({
        type: 'LOAD_PREFERENCES',
        payload: {
          theme: (savedTheme as Theme) || 'system',
          notifications: savedNotifications ? JSON.parse(savedNotifications) : true,
        }
      });
    } catch (error) {
      console.error('Error loading theme preferences:', error);
    }
  };

  const savePreferences = async () => {
    try {
      await AsyncStorage.setItem('theme', state.theme);
      await AsyncStorage.setItem('notifications', JSON.stringify(state.notificationsEnabled));
    } catch (error) {
      console.error('Error saving theme preferences:', error);
    }
  };

  const colors = state.isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ state, dispatch, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}