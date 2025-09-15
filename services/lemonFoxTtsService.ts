import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export class LemonFoxTtsService {
  private static instance: LemonFoxTtsService;
  private apiKey: string;
  private baseUrl = 'https://api.lemonfox.ai/v1';
  private currentSound: Audio.Sound | null = null;
  private isPlaying = false;

  static getInstance(): LemonFoxTtsService {
    if (!LemonFoxTtsService.instance) {
      LemonFoxTtsService.instance = new LemonFoxTtsService();
    }
    return LemonFoxTtsService.instance;
  }

  private constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_LEMON_FOX_API_KEY || '';
    
    if (!this.apiKey) {
      console.error('❌ Lemon Fox TTS API key missing');
      console.warn('⚠️ Please set EXPO_PUBLIC_LEMON_FOX_API_KEY in your .env file for voice features');
    } else {
      console.log('✅ Lemon Fox TTS service initialized');
    }
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      await Audio.setIsEnabledAsync(true);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, // Allow recording for STT integration
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
      
      console.log('🦊🔊 Lemon Fox TTS audio session initialized');
    } catch (error) {
      console.error('❌ Lemon Fox TTS audio initialization error:', error);
    }
  }

  async speak(text: string, voice: string = 'alloy'): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('Lemon Fox API key not configured');
      }

      if (!text.trim()) {
        console.warn('⚠️ Empty text provided to TTS');
        return;
      }

      console.log('🦊🔊 Starting Lemon Fox TTS...');
      
      // Stop any current playback
      await this.stopSpeaking();
      
      this.isPlaying = true;

      // Set audio mode for playback with speaker enforcement
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, // Allow recording for STT integration
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      // Force speaker output on iOS
      if (Platform.OS === 'ios') {
        await this.forceSpeakerOutput();
      }

      // Generate speech using Lemon Fox API
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lemon Fox TTS API error: ${response.status} - ${errorText}`);
      }

      // Get audio data as base64
      const audioBuffer = await response.arrayBuffer();
      // Convert ArrayBuffer to base64 using React Native compatible method
      const uint8Array = new Uint8Array(audioBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64Audio = btoa(binaryString);
      const audioUri = `data:audio/mp3;base64,${base64Audio}`;

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );

      this.currentSound = sound;

      // Wait for playback to complete
      await new Promise<void>((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              console.log('🦊✅ TTS playback completed');
              resolve();
            }
          } else if (!status.isLoaded && 'error' in status && status.error) {
            console.error('🦊❌ TTS playback error:', status.error);
            reject(new Error(status.error));
          }
        });
      });

    } catch (error) {
      console.error('🦊❌ TTS error:', error);
      throw error;
    } finally {
      this.isPlaying = false;
      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }
    }
  }

  private async forceSpeakerOutput(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // iOS-specific speaker enforcement
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
        
        // Additional delay for iOS audio session to settle
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('🦊❌ Speaker enforcement error:', error);
    }
  }

  async playAudioAndWait(text: string, voice: string = 'alloy'): Promise<void> {
    await this.speak(text, voice);
    
    // Add a small delay after TTS completion before allowing other audio operations
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async stopSpeaking(): Promise<void> {
    try {
      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }
      this.isPlaying = false;
    } catch (error) {
      console.error('🦊❌ Stop speaking error:', error);
    }
  }

  async stopAll(): Promise<void> {
    await this.stopSpeaking();
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentMode(): 'idle' | 'speaking' {
    return this.isPlaying ? 'speaking' : 'idle';
  }
}
