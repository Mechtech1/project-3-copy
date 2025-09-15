import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import { User } from 'lucide-react-native';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { state } = useAuth();
  const { colors } = useTheme();

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    const styles = createStyles(colors);
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <View style={styles.errorContent}>
          <User size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.error }]}>Configuration Required</Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {getSupabaseConfigError()}
          </Text>
          <Text style={[styles.errorInstructions, { color: colors.textSecondary }]}>
            1. Create a .env file in your project root{'\n'}
            2. Add your Supabase project URL and anonymous key{'\n'}
            3. Restart the development server
          </Text>
        </View>
      </View>
    );
  }

  // Show loading screen while checking authentication
  if (state.isLoading) {
    const styles = createStyles(colors);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContent}>
          <User size={64} color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.text }]}>MechVision AR</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking authentication...
          </Text>
        </View>
      </View>
    );
  }

  // Show authentication modal if user is not authenticated
  if (!state.isAuthenticated) {
    const styles = createStyles(colors);
    return (
      <View style={[styles.authContainer, { backgroundColor: colors.background }]}>
        <View style={styles.authContent}>
          <User size={80} color={colors.primary} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Welcome to MechVision</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Your AI-powered automotive repair assistant
          </Text>
          <Text style={[styles.authDescription, { color: colors.textSecondary }]}>
            Sign in or create an account to save your vehicles, repair history, and access all features.
          </Text>
        </View>
        
        <AuthModal
          visible={true}
          onClose={() => {}} // Can't close - authentication is mandatory
          initialMode="signin"
        />
      </View>
    );
  }

  // User is authenticated - show the main app
  return <>{children}</>;
}

const createStyles = (colors: any) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
  },
  loadingSpinner: {
    marginVertical: 24,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  errorInstructions: {
    fontSize: 14,
    textAlign: 'left',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});