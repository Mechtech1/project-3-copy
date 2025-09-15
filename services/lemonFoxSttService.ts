import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { PermissionChecker } from './permissionChecker';

export interface SttResult {
  text: string;
  confidence?: number;
  duration?: number;
}

export class LemonFoxSttService {
  private static instance: LemonFoxSttService;
  private apiKey: string;
  private baseUrl = 'https://api.lemonfox.ai/v1';
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private hasPermission = false;
  private permissionDenied = false;
  private isWakeWordListening = false;
  private isCommandListening = false;
  private wakeWordDetected = false;
  private isTtsPlaying = false; // Track TTS playing state to prevent audio session conflicts
  private restartTimerId: NodeJS.Timeout | null = null; // Track restart timer to prevent multiple restarts
  private startingWakeWord = false; // Async lock for startWakeWordListening

  static getInstance(): LemonFoxSttService {
    if (!LemonFoxSttService.instance) {
      LemonFoxSttService.instance = new LemonFoxSttService();
    }
    return LemonFoxSttService.instance;
  }

  private constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_LEMON_FOX_API_KEY || '';
    
    if (!this.apiKey) {
      console.error('❌ Lemon Fox STT API key missing');
      console.warn('⚠️ Please set EXPO_PUBLIC_LEMON_FOX_API_KEY in your .env file for voice features');
    } else {
      console.log('✅ Lemon Fox STT service initialized');
    }
  }

  private async ensureAudioSessionForRecording(): Promise<void> {
    try {
      // Enable audio system
      await Audio.setIsEnabledAsync(true);
      
      // Smart audio session configuration - preserves TTS settings while enabling recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,        // Essential for STT recording
        playsInSilentModeIOS: true,      // Preserve TTS functionality
        shouldDuckAndroid: false,        // Preserve TTS settings
        playThroughEarpieceAndroid: false, // Preserve TTS settings
        staysActiveInBackground: true,   // Preserve TTS settings
      });
      
      console.log('🎤 STT audio session configured for recording (TTS-compatible)');
    } catch (error) {
      console.error('❌ STT audio session setup error:', error);
      throw error;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (this.permissionDenied) {
      console.log('❌ STT permissions previously denied, not retrying');
      return false;
    }

    if (this.hasPermission) {
      return true;
    }

    try {
      console.log('🎤 Checking microphone permissions for STT...');
      this.hasPermission = await PermissionChecker.checkAndRequestMicrophonePermission();
      
      if (!this.hasPermission) {
        this.permissionDenied = true;
        console.log('❌ STT microphone permission denied - stopping retry attempts');
      }
      
      return this.hasPermission;
    } catch (error) {
      console.error('❌ Error checking STT permissions:', error);
      this.permissionDenied = true;
      return false;
    }
  }

  async startWakeWordListening(): Promise<string | null> {
    if (this.startingWakeWord) {
      console.log('⏸️ STT wake word listening already in progress');
      return null;
    }

    this.startingWakeWord = true;
    try {
      if (this.isWakeWordListening || this.isRecording || this.isTtsPlaying) {
        this.startingWakeWord = false;
        return null;
      }

      // Check permissions first
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        this.startingWakeWord = false;
        throw new Error('Microphone permission denied for STT');
      }

      // Cleanup any existing Recording objects BEFORE configuring audio session
      await this.cleanupRecording();

      // Ensure audio session is properly configured for recording
      await this.ensureAudioSessionForRecording();

      this.isWakeWordListening = true;
      console.log('🎤👂 Starting seamless wake word listening for "jarvis"...');
      
      const result = await this.recordSeamlessCommand();
      this.startingWakeWord = false;
      return result;
      
    } catch (error) {
      console.error('❌ Error starting wake word listening:', error);
      this.isWakeWordListening = false;
      this.startingWakeWord = false;
      throw error;
    }
  }

  private async recordSeamlessCommand(): Promise<string | null> {
    if (!this.isWakeWordListening) return null;

    try {
      // Single seamless recording for wake word + command (7 seconds)
      await this.startRecordingInternal();
      console.log('🎤🎯 Recording seamless command (7 seconds)...');
      
      // Wait 7 seconds for full "Jarvis + command" speech
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      const audioUri = await this.stopRecordingInternal();
      this.isWakeWordListening = false;
      
      if (audioUri) {
        const fullTranscript = await this.transcribeAudio(audioUri);
        console.log('🎤📝 Full transcript:', fullTranscript);
        
        if (fullTranscript) {
          // Extract command after wake word
          const command = this.extractCommandFromTranscript(fullTranscript);
          
          if (command) {
            console.log('🎤✅ Extracted command:', command);
            // Don't restart here - RepairSession will handle restart after processing
            return command;
          } else {
            console.log('🎤❌ No wake word detected, scheduling restart...');
            // Schedule single restart with proper guards
            this.scheduleRestart(500);
            return null;
          }
        }
      }
      
      // Schedule single restart if no audio
      this.scheduleRestart(500);
      return null;
      
    } catch (error) {
      console.error('❌ Error in seamless recording:', error);
      this.isWakeWordListening = false;
      
      // Cleanup any Recording object before scheduling restart
      await this.cleanupRecording();
      
      // Schedule single restart after error with longer delay
      this.scheduleRestart(2000);
      return null;
    }
  }

  private extractCommandFromTranscript(transcript: string): string | null {
    const lowerTranscript = transcript.toLowerCase();
    
    // Look for various forms of "jarvis"
    const wakeWordPatterns = [
      'jarvis',
      'jarvis,',
      'jarvis.',
      'jarvis!',
      'jarvis?'
    ];
    
    for (const pattern of wakeWordPatterns) {
      const index = lowerTranscript.indexOf(pattern);
      if (index !== -1) {
        // Extract everything after the wake word
        const commandStart = index + pattern.length;
        const command = transcript.substring(commandStart).trim();
        
        // Remove leading punctuation and whitespace
        const cleanCommand = command.replace(/^[,\.!\?\s]+/, '').trim();
        
        if (cleanCommand.length > 0) {
          console.log(`🎤🔍 Found wake word "${pattern}" at position ${index}`);
          console.log(`🎤📤 Extracted command: "${cleanCommand}"`);
          return cleanCommand;
        }
      }
    }
    
    console.log('🎤❌ No wake word found in transcript:', transcript);
    return null;
  }

  private async startRecordingInternal(): Promise<void> {
    if (this.isRecording) {
      console.warn('⚠️ Already recording');
      return;
    }

    // Recording cleanup is now done before audio session configuration

    try {
      // Configure recording options for WAV format
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      };

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();
      this.isRecording = true;
      
      console.log('🎤✅ STT recording started successfully (smart session management)');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      // Cleanup Recording object if error occurs
      await this.cleanupRecording();
      throw error;
    }
  }

  private async stopRecordingInternal(): Promise<string | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.warn('⚠️ Not currently recording');
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.isRecording = false;
      this.recording = null;

      if (uri) {
        console.log('🎤 Stopped recording, audio file:', uri);
        return uri;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error stopping STT recording:', error);
      this.isRecording = false;
      this.recording = null;
      return null;
    }
  }

  private async transcribeAudio(audioUri: string): Promise<string | null> {
    try {
      console.log('🦊🎤 Sending audio to Lemon Fox STT...');
      
      // Read the audio file using the new File API
      try {
        const file = new File([await fetch(audioUri).then(r => r.blob())], 'recording.wav', { type: 'audio/wav' });
        if (!file) {
          throw new Error('Audio file does not exist');
        }
      } catch (fileError) {
        // Fallback to legacy API if new API fails
        const audioInfo = await FileSystem.getInfoAsync(audioUri);
        if (!audioInfo.exists) {
          throw new Error('Audio file does not exist');
        }
      }

      // Create form data for file upload
      const formData = new FormData();
      
      // Add the audio file
      formData.append('file', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'recording.wav',
      } as any);
      
      formData.append('language', 'english');
      formData.append('response_format', 'json');

      // Prepare the request with FormData
      const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_LEMON_FOX_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lemon Fox STT API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const transcript = result.text?.trim();
      
      // Clean up the audio file using safer approach
      try {
        // Try new API first, fallback to legacy if needed
        try {
          await fetch(audioUri, { method: 'DELETE' });
        } catch {
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
        }
      } catch (deleteError) {
        console.warn('⚠️ Could not delete audio file:', deleteError);
      }
      
      return transcript || null;
      
    } catch (error) {
      console.error('❌ Error transcribing audio:', error);
      
      // Clean up the audio file even on error using safer approach
      try {
        try {
          await fetch(audioUri, { method: 'DELETE' });
        } catch {
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
        }
      } catch (deleteError) {
        console.warn('⚠️ Could not delete audio file:', deleteError);
      }
      
      return null;
    }
  }

  // Legacy method for backward compatibility - now triggers wake word listening
  async startRecording(): Promise<void> {
    await this.startWakeWordListening();
  }

  // Legacy method for backward compatibility - now returns command result
  async stopRecording(): Promise<string | null> {
    if (this.isCommandListening) {
      // If we're in command listening mode, wait for it to complete
      while (this.isCommandListening) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return null;
  }

  async transcribeFromUri(audioUri: string): Promise<SttResult | null> {
    try {
      const text = await this.transcribeAudio(audioUri);
      if (text) {
        return {
          text,
          confidence: 1.0, // Lemon Fox doesn't provide confidence scores in basic response
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error transcribing audio:', error);
      return null;
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  stopWakeWordListening(): void {
    console.log('🎤🛑 Stopping wake word listening...');
    this.isWakeWordListening = false;
    this.wakeWordDetected = false;
    
    if (this.recording && this.isRecording) {
      this.recording.stopAndUnloadAsync().catch(console.error);
      this.recording = null;
      this.isRecording = false;
    }
  }

  cleanup(): void {
    console.log('🎤🧹 Cleaning up STT service...');
    this.isWakeWordListening = false;
    this.isCommandListening = false;
    this.wakeWordDetected = false;
    
    if (this.recording && this.isRecording) {
      this.recording.stopAndUnloadAsync().catch(console.error);
    }
    this.recording = null;
    this.isRecording = false;
  }

  get isListening(): boolean {
    return this.isWakeWordListening || this.isCommandListening;
  }

  // Methods to coordinate with TTS playback
  setTtsPlaying(isPlaying: boolean): void {
    this.isTtsPlaying = isPlaying;
    console.log(`🎤${isPlaying ? '⏸️' : '▶️'} STT ${isPlaying ? 'paused for TTS' : 'ready to resume'}`);
  }

  getTtsPlaying(): boolean {
    return this.isTtsPlaying;
  }

  // Public method for RepairSession to request STT restart
  requestRestart(delay: number = 500): void {
    console.log('🎤📞 STT restart requested from RepairSession');
    this.scheduleRestart(delay);
  }

  private async cleanupRecording(): Promise<void> {
    try {
      if (this.recording) {
        // Always use stopAndUnloadAsync to properly cleanup Recording
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      this.isRecording = false;
      console.log('🎤🧹 Recording object cleaned up');
    } catch (error) {
      console.warn('⚠️ Error cleaning up recording:', error);
      // Force cleanup even if error
      this.recording = null;
      this.isRecording = false;
    }
  }

  private scheduleRestart(delay: number): void {
    // Clear any existing restart timer to prevent multiple restarts
    if (this.restartTimerId) {
      clearTimeout(this.restartTimerId);
      this.restartTimerId = null;
      console.log('🎤❌ Cancelled previous restart timer');
    }
    
    this.restartTimerId = setTimeout(() => {
      this.restartTimerId = null;
      
      // Only restart if no other STT instance is running and TTS is not playing
      if (!this.isWakeWordListening && !this.isRecording && !this.isTtsPlaying) {
        console.log('🎤🔄 Restarting STT after delay...');
        this.startWakeWordListening();
      } else {
        console.log('🎤⏸️ STT restart skipped - another instance active or TTS playing');
      }
    }, delay);
  }
}
