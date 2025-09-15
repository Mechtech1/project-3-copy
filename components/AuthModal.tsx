import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  mandatory?: boolean;
}

export default function AuthModal({ visible, onClose, initialMode = 'signin', mandatory = false }: AuthModalProps) {
  const { colors } = useTheme();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const styles = createStyles(colors);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleSignIn = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    const result = await signIn(email, password);
    setIsLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Welcome back! You can now save vehicles to your profile.');
      handleClose();
    } else {
      Alert.alert('Sign In Failed', result.error || 'Please check your credentials and try again.');
    }
  };

  const handleSignUp = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const result = await signUp(email, password);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        'Account Created!', 
        'Your account has been created successfully. You can now save vehicles to your profile.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } else {
      Alert.alert('Sign Up Failed', result.error || 'Please try again.');
    }
  };

  const handleResetPassword = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    const result = await resetPassword(email);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        'Reset Email Sent',
        'Check your email for password reset instructions.',
        [{ text: 'OK', onPress: () => setMode('signin') }]
      );
    } else {
      Alert.alert('Reset Failed', result.error || 'Please try again.');
    }
  };

  const handleSubmit = () => {
    switch (mode) {
      case 'signin':
        handleSignIn();
        break;
      case 'signup':
        handleSignUp();
        break;
      case 'reset':
        handleResetPassword();
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          {!mandatory ? (
            <TouchableOpacity onPress={handleClose}>
              <Text style={[styles.cancelButton, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={[styles.title, { color: colors.text }]}>
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <User size={48} color={colors.primary} />
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mode === 'signin' 
              ? 'Sign in to save vehicles to your profile'
              : mode === 'signup'
              ? 'Create an account to save your vehicles'
              : 'Enter your email to reset your password'
            }
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Email address"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {mode !== 'reset' && (
              <View style={styles.inputContainer}>
                <Lock size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Lock size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                isLoading && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              {mode === 'signin' && (
                <>
                  <TouchableOpacity onPress={() => setMode('reset')}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode('signup')}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      Don't have an account? Sign up
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {mode === 'signup' && (
                <TouchableOpacity onPress={() => setMode('signin')}>
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    Already have an account? Sign in
                  </Text>
                </TouchableOpacity>
              )}

              {mode === 'reset' && (
                <TouchableOpacity onPress={() => setMode('signin')}>
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});