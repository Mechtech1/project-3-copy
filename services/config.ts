// Configuration constants for services
// CLEANED: Removed all legacy audio service configurations
// Only Lemon Fox API key is now used via environment variables

// Use environment variables for API keys
export const LEMON_FOX_API_KEY = process.env.EXPO_PUBLIC_LEMON_FOX_API_KEY || '';

// Validate required API keys
if (!LEMON_FOX_API_KEY) {
  console.warn('⚠️ EXPO_PUBLIC_LEMON_FOX_API_KEY not found in environment variables');
}