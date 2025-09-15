import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Scan, Car, Camera } from 'lucide-react-native';
import { ArrowLeft } from 'lucide-react-native';
import { decodeVin, validateVin } from '@/services/vinService';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { VehicleProfileService } from '@/services/vehicleProfileService';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import CameraVinScanner from '@/components/CameraVinScanner';
import { useAuth } from '@/contexts/AuthContext';

interface VinScannerProps {
  onVehicleAdded?: () => void;
  onBack?: () => void;
}

export default function VinScanner({ onVehicleAdded, onBack }: VinScannerProps) {
  const [vin, setVin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMethod, setInputMethod] = useState<'manual' | 'scan'>('manual');
  const [showCamera, setShowCamera] = useState(false);
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();
  const { state: authState } = useAuth();
  const vehicleService = VehicleProfileService.getInstance();

  const handleVinSubmit = async () => {
    if (!validateVin(vin)) {
      Alert.alert('Invalid VIN', 'Please enter a valid 17-character VIN number.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting VIN decode for:', vin);
      const vehicle = await decodeVin(vin.toUpperCase());
      console.log('VIN decode result:', vehicle);
      
      // Auto-save vehicle to user profile (user is always authenticated now)
      try {
        await vehicleService.addVehicleByVin(vin.toUpperCase());
        console.log('Vehicle auto-saved to profile for user:', authState.user?.email);
        
        // Reload the parent component's vehicle list
        if (onVehicleAdded) {
          onVehicleAdded();
        }
      } catch (saveError) {
        console.warn('Failed to auto-save vehicle:', saveError);
        // Don't show error to user if vehicle already exists
        if (!saveError.message?.includes('already exists')) {
          Alert.alert('Save Warning', 'Vehicle identified but could not be saved to profile. You can still proceed with repairs.');
        }
      }
      
      if (vehicle) {
        dispatch({ type: 'SET_VEHICLE', payload: vehicle });
        
        const saveMessage = '\n\nVehicle saved to your profile!';
        
        Alert.alert(
          'Vehicle Identified!', 
          `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          [
            {
              text: 'View Repairs',
              onPress: () => router.push('/(tabs)/repairs')
            },
            { 
              text: 'Back to Vehicles', 
              onPress: () => {
                // Clear current vehicle and notify parent to refresh list
                if (onVehicleAdded) {
                  onVehicleAdded();
                }
                setVin('');
              }
            }
          ]
        );
      } else {
        throw new Error('Unable to decode VIN - no vehicle data returned');
      }
    } catch (error) {
      console.error('VIN decode error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to decode VIN';
      Alert.alert(
        'VIN Decode Error', 
        errorMessage,
        [
          { text: 'Try Again' },
          { 
            text: 'Use Demo VIN', 
            onPress: () => {
              setVin('1HGBH41JXMN109186');
            }
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

      const handleCameraVinDetected = async (detectedVin: string) => {
      try {
        setShowCamera(false);
        setVin(detectedVin);
        setInputMethod('manual'); // Switch to manual to show the detected VIN
        
        // Wait longer for state to settle and camera to fully close
        setTimeout(async () => {
          try {
            // Double-check VIN is still valid before auto-submitting
            if (detectedVin && validateVin(detectedVin)) {
              await handleVinSubmit();
            }
          } catch (submitError) {
            console.error('Error in auto VIN submission:', submitError);
            // Don't show alert to user, just log the error
          }
        }, 1000); // Increased delay to prevent race conditions
      } catch (error) {
        console.error('Error in VIN detection handler:', error);
        // Fallback: just set the VIN without auto-submission
        setVin(detectedVin);
        setInputMethod('manual');
      }
    };

  const handleCloseCameraScanner = () => {
    setShowCamera(false);
    setInputMethod('manual');
  };

  const handleQuickDemo = () => {
    setVin('1HGBH41JXMN109186');
  };

  const styles = createStyles(colors);

  // Show camera scanner modal
  if (showCamera) {
    return (
      <CameraVinScanner
        onVinDetected={handleCameraVinDetected}
        onClose={handleCloseCameraScanner}
      />
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      {state.vehicle ? (
        <View style={styles.vehicleIdentified}>
          <View style={styles.successIcon}>
            <Car size={48} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.success }]}>Vehicle Identified</Text>
          <Text style={[styles.vehicleInfo, { color: colors.text }]}>
            {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
            {state.vehicle.trim && ` ${state.vehicle.trim}`}
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            VIN: {state.vehicle.vin}
          </Text>
          
          <TouchableOpacity 
            style={[styles.repairsButton, { backgroundColor: colors.success }]}
            onPress={() => router.push('/(tabs)/repairs')}
          >
            <Text style={styles.repairsButtonText}>View Available Repairs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.resetButton, { borderColor: colors.textSecondary }]}
            onPress={() => {
              dispatch({ type: 'SET_VEHICLE', payload: null });
              setVin('');
            }}
          >
            <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Scan Different Vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Back Button - Only show if onBack callback is provided */}
          {onBack && (
            <View style={styles.backButtonContainer}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={onBack}
              >
                <ArrowLeft size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.header}>
            <Car size={64} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>Welcome to MechVision</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your AI-powered mechanic assistant. Enter your vehicle's VIN to get started.
            </Text>
          </View>

          <View style={[styles.methodSelector, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[
                styles.methodButton,
                inputMethod === 'manual' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setInputMethod('manual')}
            >
              <Text style={[
                styles.methodButtonText,
                { color: inputMethod === 'manual' ? '#FFFFFF' : colors.textSecondary }
              ]}>
                Manual Entry
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodButton,
                inputMethod === 'scan' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setInputMethod('scan')}
            >
              <Scan size={16} color={inputMethod === 'scan' ? '#FFFFFF' : colors.textSecondary} />
              <Text style={[
                styles.methodButtonText,
                { color: inputMethod === 'scan' ? '#FFFFFF' : colors.textSecondary }
              ]}>
                Scan VIN
              </Text>
            </TouchableOpacity>
          </View>

          {inputMethod === 'manual' ? (
            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: colors.text }]}>Vehicle Identification Number (VIN)</Text>
              <TextInput
                style={[styles.vinInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={vin}
                onChangeText={setVin}
                placeholder="Enter 17-character VIN"
                placeholderTextColor={colors.textSecondary}
                maxLength={17}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          ) : (
            <View style={styles.scanSection}>
              <View style={[styles.scanPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Camera size={48} color={colors.textSecondary} />
                <Text style={[styles.scanPlaceholderTitle, { color: colors.text }]}>VIN Camera Scanner</Text>
                <Text style={[styles.scanPlaceholderText, { color: colors.textSecondary }]}>
                  Use your camera to automatically detect and scan VIN codes
                </Text>
                <TouchableOpacity
                  style={[styles.cameraButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowCamera(true)}
                >
                  <Camera size={20} color="#FFFFFF" />
                  <Text style={styles.cameraButtonText}>Open Camera Scanner</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.manualFallbackButton}
                onPress={() => setInputMethod('manual')}
              >
                <Text style={[styles.manualFallbackText, { color: colors.primary }]}>Enter VIN manually instead</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[
                styles.submitButton, 
                { backgroundColor: (!vin || isLoading) ? colors.border : colors.primary }
              ]}
              onPress={handleVinSubmit}
              disabled={!vin || isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Decoding VIN...' : 'Identify Vehicle'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.demoButton, { borderColor: colors.warning }]} 
              onPress={handleQuickDemo}
            >
              <Text style={[styles.demoButtonText, { color: colors.warning }]}>Try Demo VIN</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  inputSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  vinInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  methodSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scanSection: {
    marginBottom: 32,
  },
  scanPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  scanPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  scanPlaceholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  manualFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  manualFallbackText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionSection: {
    gap: 16,
  },
  submitButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  demoButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleIdentified: {
    alignItems: 'center',
    marginTop: 60,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  vehicleInfo: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  repairsButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  repairsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  backButton: {
   width: 44,
   height: 44,
   justifyContent: 'center',
   alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});