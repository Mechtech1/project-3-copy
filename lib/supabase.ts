import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// Get environment variables with fallbacks
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing:');
  console.error('- EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('- EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.warn('Please create a .env file with your Supabase credentials and restart the dev server.');
}

// Create Supabase client optimized for React Native
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && 
           supabaseAnonKey && 
           supabaseUrl !== 'https://placeholder.supabase.co' && 
           supabaseAnonKey !== 'placeholder-key' &&
           supabaseUrl.includes('supabase.co') &&
           supabaseAnonKey.length > 20);
}

// Helper function to get configuration error message
export function getSupabaseConfigError(): string {
  if (!isSupabaseConfigured()) {
    return 'Supabase is not configured. Please create a .env file with your actual Supabase project URL and anonymous key, then restart the development server.';
  }
  return '';
}