import { Audio } from 'expo-av';
import { Platform, PermissionsAndroid } from 'react-native';

export class PermissionChecker {
  static async checkAndRequestMicrophonePermission(): Promise<boolean> {
    try {
      console.log('🎤 Checking microphone permissions for platform:', Platform.OS);
      
      if (Platform.OS === 'android') {
        // Check if permission is already granted
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        
        if (granted) {
          console.log('✅ Android microphone permission already granted');
          return true;
        }
        
        // Request permission
        console.log('🎤 Requesting Android microphone permission...');
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone for voice commands.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
        console.log('🎤 Android permission result:', result, 'Granted:', isGranted);
        return isGranted;
        
      } else if (Platform.OS === 'ios') {
        // For iOS, use Expo Audio
        console.log('🎤 Requesting iOS microphone permission...');
        const { status, granted } = await Audio.requestPermissionsAsync();
        
        console.log('🎤 iOS permission status:', status, 'Granted:', granted);
        return status === 'granted';
        
      } else {
        // Web platform
        console.log('🎤 Web platform - checking navigator.mediaDevices...');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Clean up
            console.log('✅ Web microphone permission granted');
            return true;
          } catch (error) {
            console.error('❌ Web microphone permission denied:', error);
            return false;
          }
        } else {
          console.error('❌ Web mediaDevices not supported');
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Error checking microphone permissions:', error);
      return false;
    }
  }
  
  static async testMicrophoneAccess(): Promise<boolean> {
    try {
      console.log('🎤 Testing microphone access...');
      
      // First check permissions
      const hasPermission = await this.checkAndRequestMicrophonePermission();
      if (!hasPermission) {
        console.error('❌ No microphone permission');
        return false;
      }
      
      // Test audio session setup
      console.log('🎤 Testing audio session setup...');
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
        console.log('✅ Audio session setup successful');
      } catch (audioError) {
        console.error('❌ Audio session setup failed:', audioError);
        return false;
      }
      
      // Test recording creation (but don't start)
      console.log('🎤 Testing recording object creation...');
      try {
        const recordingOptions = {
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.MAX,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          web: {
            mimeType: 'audio/mp3',
            bitsPerSecond: 128000,
          },
        };
        
        const { recording } = await Audio.Recording.createAsync(recordingOptions);
        console.log('✅ Recording object created successfully');
        
        // Clean up immediately
        await recording.stopAndUnloadAsync();
        console.log('✅ Recording cleaned up');
        
        return true;
      } catch (recordingError) {
        console.error('❌ Recording creation failed:', recordingError);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Microphone test failed:', error);
      return false;
    }
  }
}