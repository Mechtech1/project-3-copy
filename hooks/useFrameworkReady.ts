import { useEffect } from 'react';
import { Platform } from 'react-native';
import { PermissionChecker } from '@/services/permissionChecker';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Initializing app and requesting permissions...');
      
      try {
        // Request microphone permission
        console.log('🎤 Requesting microphone permission...');
        const micPermission = await PermissionChecker.checkAndRequestMicrophonePermission();
        console.log('🎤 Microphone permission result:', micPermission);
        
        // Request camera permission
        console.log('📷 Requesting camera permission...');
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        console.log('📷 Camera permission result:', cameraPermission.status);
        
        // Request location permission
        console.log('📍 Requesting location permission...');
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        console.log('📍 Location permission result:', locationPermission.status);
        
        // Summary of permissions
        console.log('✅ Permission summary:');
        console.log('  - Microphone:', micPermission ? '✅' : '❌');
        console.log('  - Camera:', cameraPermission.status === 'granted' ? '✅' : '❌');
        console.log('  - Location:', locationPermission.status === 'granted' ? '✅' : '❌');
        
        if (Platform.OS === 'web') {
          window.frameworkReady?.();
        }
        
      } catch (error) {
        console.error('❌ Error requesting permissions:', error);
        
        if (Platform.OS === 'web') {
          window.frameworkReady?.();
        }
      }
    };
    
    initializeApp();
  }, []);
}
