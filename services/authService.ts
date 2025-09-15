import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Alert } from 'react-native';

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      // Check Supabase configuration before attempting sign up
      if (!isSupabaseConfigured()) {
        return { 
          user: null, 
          error: 'Supabase is not configured. Please set up your .env file with Supabase credentials and restart the app.' 
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        return { user: null, error: error.message };
      }

      if (data.user) {
        // User profile will be created automatically via trigger
        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          createdAt: data.user.created_at,
          updatedAt: data.user.updated_at || data.user.created_at,
        };

        return { user, error: null };
      }

      return { user: null, error: 'Failed to create user' };
    } catch (error) {
      console.error('Sign up exception:', error);
      return { user: null, error: 'An unexpected error occurred during sign up' };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      // Check Supabase configuration before attempting sign in
      if (!isSupabaseConfigured()) {
        return { 
          user: null, 
          error: 'Supabase is not configured. Please set up your .env file with Supabase credentials and restart the app.' 
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        // Provide more helpful error messages for common issues
        if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
          return { 
            user: null, 
            error: 'Unable to connect to authentication server. Please check your internet connection and Supabase configuration.' 
          };
        }
        return { user: null, error: error.message };
      }

      if (data.user) {
        // Get user profile from our users table
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError || !userProfile) {
          console.error('Error fetching user profile:', profileError);
          // Create profile if it doesn't exist
          const { error: createError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
            });

          if (createError) {
            console.error('Error creating user profile:', createError);
          }
        }

        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          createdAt: userProfile?.created_at || data.user.created_at,
          updatedAt: userProfile?.updated_at || data.user.updated_at || data.user.created_at,
        };

        return { user, error: null };
      }

      return { user: null, error: 'Failed to sign in' };
    } catch (error) {
      console.error('Sign in exception:', error);
      return { user: null, error: 'An unexpected error occurred during sign in' };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Sign out exception:', error);
      return { error: 'An unexpected error occurred during sign out' };
    }
  }

  /**
   * Get current user session
   */
  async getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        if (error.message === 'Auth session missing!') {
          // This is normal for unauthenticated users, not an error
          return { user: null, error: null };
        }
        console.error('Get user error:', error);
        return { user: null, error: error.message };
      }

      if (!user) {
        return { user: null, error: null };
      }

      // Get user profile from our users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        console.warn('User profile not found, creating one...');
        // Create profile if it doesn't exist
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
          });

        if (createError) {
          console.error('Error creating user profile:', createError);
        }
      }

      const currentUser: User = {
        id: user.id,
        email: user.email!,
        createdAt: userProfile?.created_at || user.created_at,
        updatedAt: userProfile?.updated_at || user.updated_at || user.created_at,
      };

      return { user: currentUser, error: null };
    } catch (error) {
      console.error('Get current user exception:', error);
      return { user: null, error: 'Failed to get current user' };
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (session?.user) {
        const { user } = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        console.error('Reset password error:', error);
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Reset password exception:', error);
      return { error: 'An unexpected error occurred' };
    }
  }
}