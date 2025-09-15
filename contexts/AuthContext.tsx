import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthService, User, AuthState } from '@/services/authService';

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SIGN_OUT' };

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
        isLoading: false,
      };
    case 'SIGN_OUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

const AuthContext = createContext<{
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const authService = AuthService.getInstance();

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      dispatch({ type: 'SET_USER', payload: user });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { user } = await authService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      console.error('Error initializing auth:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signUp = async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    const { user, error } = await authService.signUp(email, password);
    
    if (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: false, error };
    }

    dispatch({ type: 'SET_USER', payload: user });
    return { success: true };
  };

  const signIn = async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    const { user, error } = await authService.signIn(email, password);
    
    if (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: false, error };
    }

    dispatch({ type: 'SET_USER', payload: user });
    return { success: true };
  };

  const signOut = async () => {
    const { error } = await authService.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
    }
    
    dispatch({ type: 'SIGN_OUT' });
  };

  const resetPassword = async (email: string) => {
    const { error } = await authService.resetPassword(email);
    
    if (error) {
      return { success: false, error };
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      state,
      dispatch,
      signUp,
      signIn,
      signOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}