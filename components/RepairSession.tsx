import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Play, Pause, Square, SkipForward, Volume2, VolumeX, Mic } from 'lucide-react-native';
import { useAppContext } from '@/contexts/AppContext';
import { RepairTask, VoiceLog } from '@/types';
import { Audio } from 'expo-av';
import { LemonFoxTtsService } from '@/services/lemonFoxTtsService';
import { LemonFoxSttService } from '@/services/lemonFoxSttService';
import { RepairAIService, RepairContext } from '@/services/repairAIService';
import ARCamera from '@/components/ARCamera';
import WorkspaceOverlayRenderer from './WorkspaceOverlayRenderer';
import ImageOverlayRenderer from './ImageOverlayRenderer';
import { getRepairTaskWithOverlay } from '@/services/repairService';
import { OverlayPack } from '@/types';
import { OverlayMode } from './OverlayPartRenderer';

interface RepairSessionProps {
  repairTask: RepairTask;
  onEndSession: () => void;
  overlayPack?: OverlayPack | null;
}

export default function RepairSession({ repairTask, onEndSession, overlayPack }: RepairSessionProps) {
  const { state, dispatch } = useAppContext();
  const [currentInstructionSpoken, setCurrentInstructionSpoken] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isListeningActive, setIsListeningActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [showSpeechPrompt, setShowSpeechPrompt] = useState(Platform.OS === 'web');

  const [speechRecognitionDisabled, setSpeechRecognitionDisabled] = useState(false);
  
  // Add overlay system state with fake 3D support
  const [currentOverlayPack, setCurrentOverlayPack] = useState<OverlayPack | null>(overlayPack || null);
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [cutawayMode, setCutawayMode] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('fake3d'); // Default to fake 3D
  const [motionSensitivity, setMotionSensitivity] = useState(1.0);
  const [enableMotionEffects, setEnableMotionEffects] = useState(true);
  const [isListeningForSpeech, setIsListeningForSpeech] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [initialInstructionSpoken, setInitialInstructionSpoken] = useState(false);
  const listeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ttsService = LemonFoxTtsService.getInstance();
  const sttService = LemonFoxSttService.getInstance();

  const repairAI = RepairAIService.getInstance();
  const lastProcessedTranscript = useRef('');
  
  // Counter to ensure unique IDs
  const idCounter = useRef(0);

  const currentStep = repairTask.steps[state.currentSession?.currentStepIndex || 0];
  const progress = ((state.currentSession?.currentStepIndex || 0) + 1) / repairTask.steps.length;
  const currentStepIndex = state.currentSession?.currentStepIndex || 0;

  // Use the overlay pack passed from the loading screen
  useEffect(() => {
    if (overlayPack) {
      setCurrentOverlayPack(overlayPack);
      console.log('✅ Using pre-loaded overlay pack:', overlayPack.id);
    }
  }, [overlayPack]);

  // Generate truly unique ID to prevent database constraint violations
  const generateUniqueId = () => {
    const timestamp = Date.now();
    const counter = ++idCounter.current;
    const random = Math.random().toString(36).substring(2, 8);
    const sessionSuffix = state.currentSession?.id?.toString().slice(-4) || '0000';
    return `voice_${timestamp}_${counter}_${random}_${sessionSuffix}`;
  };

  // Initialize continuous speech recognition when session starts
  useEffect(() => {
    if (!isPaused) {
      setTimeout(async () => {
        if (!isPaused) {
          console.log('Initial startup - AI speech finished, voice interface ready');
        }
      }, 4000);
    }
    
    return () => {
      ttsService.stopAll().catch(console.error);
    };
  }, [isPaused]);

  // Initialize repair AI context when component mounts
  useEffect(() => {
    repairAI.clearConversation();
    setCurrentInstructionSpoken(false);
    console.log('Repair AI initialized for:', repairTask.name);
  }, [repairTask.id, repairTask.name]);

  // Handle step changes
  useEffect(() => {
    if (currentStep && !isPaused) {

      if (!currentInstructionSpoken) {
        speakInstruction(currentStep.audioScript);
        setCurrentInstructionSpoken(true);
      }
    }
  }, [currentStep?.id, currentInstructionSpoken, isPaused]);

  // Enhanced speech instruction function
  const speakInstruction = async (text: string) => {
    if (isPaused) return;
    
    if (Platform.OS === 'web' && !speechEnabled) {
      setShowSpeechPrompt(true);
      return;
    }
    
    try {
      setIsProcessingVoice(true);
      
      await ttsService.speak(text);
      
      const voiceLog: VoiceLog = {
        id: generateUniqueId(),
        timestamp: new Date().toISOString(),
        type: 'assistant',
        text,
        audioGenerated: true,
        stepIndex: currentStepIndex,
        repairTask: repairTask.name,
      };
      dispatch({ type: 'ADD_VOICE_LOG', payload: voiceLog });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsProcessingVoice(false);
      setIsTtsPlaying(false);
      setInitialInstructionSpoken(true);
      
    } catch (error) {
      console.error('Error in speech instruction:', error);
      setIsProcessingVoice(false);
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    if (isPaused || isProcessingVoice) return;
    
    setIsProcessingVoice(true);
    
    const voiceLog: VoiceLog = {
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
      type: 'user',
      text: transcript,
    };
    dispatch({ type: 'ADD_VOICE_LOG', payload: voiceLog });
    
    await handleVoiceCommand(transcript);
    
    setIsProcessingVoice(false);
  };

  const handleVoiceCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    console.log('Processing voice command:', command);
    
    if (lowerCommand.includes('next step') || lowerCommand.includes('continue') || lowerCommand.includes("what's next")) {
      console.log('Navigation command detected: next step');
      await handleNextStep();
      return;
    }
    
    if (lowerCommand.includes('pause session') || lowerCommand.includes('stop session')) {
      console.log('Navigation command detected: pause/stop');
      handlePauseResume();
      return;
    }

    if (lowerCommand.includes('repeat') || lowerCommand.includes('again') || lowerCommand.includes('say that again')) {
      console.log('Repeat command detected');
      const currentStep = repairTask.steps[currentStepIndex];
      await speakInstruction(currentStep.audioScript);
      // Toggle overlay mode between flat and fake3d
      const toggleOverlayMode = () => {
        setOverlayMode(prev => prev === 'flat' ? 'fake3d' : 'flat');
      };
      toggleOverlayMode();
      return;
    }

    try {
      console.log('Sending to AI assistant:', command);
      const repairContext: RepairContext = {
        vehicle: {
          make: 'Unknown',
          model: 'Unknown', 
          year: new Date().getFullYear(),
          vin: state.currentSession?.vehicleVin,
        },
        repairTask: repairTask,
        currentStep: {
          ...currentStep,
          stepNumber: currentStepIndex + 1,
        },
        currentStepIndex,
        completedSteps: state.currentSession?.stepLog || [],
        voiceHistory: state.currentSession?.voiceTranscript?.map(log => ({
          role: log.type,
          content: log.text,
          timestamp: new Date(log.timestamp)
        })) || [],
      };

      const aiResponse = await repairAI.generateRepairResponse(command, repairContext);
      console.log('AI response received:', aiResponse.substring(0, 100) + '...');
      
      await speakInstruction(aiResponse);
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const fallbackResponse = "I'm having trouble connecting to the AI assistant right now. You can try asking again, or say 'next step' to continue with the repair.";
      await speakInstruction(fallbackResponse);
    }
  };

  const handleNextStep = async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < repairTask.steps.length) {
      dispatch({ type: 'UPDATE_SESSION_STEP', payload: nextIndex });
      setCurrentInstructionSpoken(false);
      
      const stepLog = `Step ${currentStepIndex + 1} completed: ${currentStep.instruction}`;
      if (state.currentSession) {
        const updatedSession = {
          ...state.currentSession,
          stepLog: [...state.currentSession.stepLog, stepLog],
          stepsCompleted: nextIndex,
        };
      }
    } else {
      await speakInstruction("Congratulations! You have completed all repair steps successfully. Great work!");
      setTimeout(() => {
        handleEndSession();
      }, 4000);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      dispatch({ type: 'RESUME_SESSION' });
      
      if (currentStep) {
        setTimeout(() => {
          speakInstruction(`Resuming repair session. ${currentStep.audioScript}`);
        }, 500);
      }
    } else {
      setIsPaused(true);
      dispatch({ type: 'PAUSE_SESSION' });
      
      ttsService.stopSpeaking().catch(console.error);
      
      
      speakInstruction("Session paused. Tap resume when you're ready to continue.");
    }
  };

  const handleEndSession = () => {
    ttsService.stopSpeaking().catch(console.error);
    
    Alert.alert(
      'Repair Session Complete',
      'Your repair session has been saved to history with full voice transcript and AI voice responses.',
      [
        {
          text: 'OK',
          onPress: () => {
            dispatch({ type: 'END_SESSION' });
            onEndSession();
          }
        }
      ]
    );
  };

  const enableSpeech = async () => {
    setSpeechEnabled(true);
    setShowSpeechPrompt(false);
    
    if (currentStep) {
      await speakInstruction(currentStep.audioScript);
      setCurrentInstructionSpoken(true);
    }
  };

  // Start wake word listening
  const startWakeWordListening = useCallback(async () => {
    if (isListeningForSpeech || isPaused || !speechEnabled || !initialInstructionSpoken || isTtsPlaying) {
      return;
    }

    try {
      console.log('Starting wake word listening for "jarvis"...');
      setIsListeningForSpeech(true);
      
      const command = await sttService.startWakeWordListening();
      
      if (command && command.trim()) {
        console.log('Processing wake word command:', command);
        setIsListeningForSpeech(false);
        await handleUserSpeech(command);
      } else {
        setIsListeningForSpeech(false);
        setTimeout(() => {
          if (!isProcessingVoice && speechEnabled && !isTtsPlaying) {
            startWakeWordListening();
          }
        }, 500);
      }
      
    } catch (error) {
      console.error('Error starting wake word listening:', error);
      setIsListeningForSpeech(false);
      
      setTimeout(() => {
        if (!isProcessingVoice && speechEnabled && !isTtsPlaying) {
          startWakeWordListening();
        }
      }, 2000);
    }
  }, [isListeningForSpeech, isPaused, speechEnabled, initialInstructionSpoken, isTtsPlaying]);

  // Start wake word listening when session begins
  useEffect(() => {
    if (!isPaused && speechEnabled && !showSpeechPrompt && !isProcessingVoice && !isTtsPlaying && initialInstructionSpoken) {
      startWakeWordListening();
    }
    
    return () => {
      sttService.cleanup();
    };
  }, [isPaused, speechEnabled, showSpeechPrompt, isProcessingVoice, isTtsPlaying, initialInstructionSpoken]);

  // Handle user speech from integrated STT
  const handleUserSpeech = async (transcript: string) => {
    if (!transcript.trim() || transcript === lastProcessedTranscript.current) {
      return;
    }

    console.log('Processing user speech:', transcript);
    lastProcessedTranscript.current = transcript;
    setCurrentTranscript(transcript);
    setIsProcessingVoice(true);

    try {
      const context: RepairContext = {
        vehicle: {
          make: state.selectedVehicle?.make || 'Unknown',
          model: state.selectedVehicle?.model || 'Unknown',
          year: state.selectedVehicle?.year || 2020,
          vin: state.selectedVehicle?.vin
        },
        repairTask: repairTask,
        currentStep: currentStep,
        currentStepIndex: currentStepIndex,
        completedSteps: [],
        voiceHistory: []
      };

      const aiResponse = await repairAI.generateRepairResponse(transcript, context);
      
      if (aiResponse) {
        console.log('AI Response:', aiResponse);
        
        const voiceLog: VoiceLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          type: 'user',
          text: transcript,
          stepIndex: currentStepIndex,
          confidence: 0.9
        };

        console.log('Voice interaction logged:', voiceLog);

        setIsTtsPlaying(true);
        sttService.setTtsPlaying(true);
        await ttsService.speak(aiResponse);
        sttService.setTtsPlaying(false);
        setIsTtsPlaying(false);
      }
    } catch (error) {
      console.error('Error processing user speech:', error);
      setIsTtsPlaying(true);
      sttService.setTtsPlaying(true);
      await ttsService.speak("I'm sorry, I didn't understand that. Could you please repeat your question?");
      sttService.setTtsPlaying(false);
      setIsTtsPlaying(false);
    } finally {
      setIsProcessingVoice(false);
      setCurrentTranscript('');
      
      if (speechEnabled && !isPaused && initialInstructionSpoken) {
        sttService.requestRestart(500);
      }
    }
  };

  // Update screen dimensions on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  // Get current step's part name for overlay highlighting
  const getCurrentPartName = (): string => {
    if (!currentStep) return '';
    
    // Map step part names to overlay part names
    const partNameMapping: Record<string, string> = {
      'battery': 'battery',
      'brake_rotor': 'brake_rotor',
      'brake_caliper': 'brake_caliper',
      'engine': 'engine',
      'oil_drain_plug': 'oil_drain_plug',
      'oil_filter': 'oil_filter',
      'air_filter': 'air_filter',
      'Air Filter Housing': 'air_filter', // Map Air Filter Housing to air_filter
      'spark_plug': 'spark_plug',
      'brake_pad': 'brake_pad',
      'tire': 'tire'
    };
    
    return partNameMapping[currentStep.partName] || currentStep.partName || '';
  };

  // Toggle overlay mode between flat and fake3d
  const toggleOverlayMode = () => {
    setOverlayMode(prev => prev === 'flat' ? 'fake3d' : 'flat');
  };

  // Adjust motion sensitivity
  const adjustMotionSensitivity = () => {
    setMotionSensitivity(prev => {
      const newValue = prev >= 2.0 ? 0.5 : prev + 0.5;
      return newValue;
    });
  };

  // Toggle motion effects
  const toggleMotionEffects = () => {
    setEnableMotionEffects(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <ARCamera />
      
      {/* Enhanced Workspace Overlay with Fake 3D Support */}
      {(() => {
        // Mount the renderer whenever overlay is enabled and an overlayPack exists.
        // The renderer itself handles cases where no active part is selected.
        const shouldRender = overlayEnabled && currentOverlayPack;
        const activePartName = getCurrentPartName();
        
        console.log('🎨 Overlay rendering decision:', {
          shouldRender,
          overlayEnabled,
          hasOverlayPack: !!currentOverlayPack,
          hasCurrentStep: !!currentStep,
          currentStepIndex,
          activePartName,
          overlayPackId: currentOverlayPack?.id,
          overlayPackWorkspaceSvg: currentOverlayPack?.workspace_svg ? `Present (${currentOverlayPack.workspace_svg.length} chars)` : 'Missing',
          overlayPackPartsCount: currentOverlayPack ? Object.keys(currentOverlayPack.parts).length : 0,
          screenDimensions
        });
        
        if (shouldRender) {
          // Use PNG overlay mode if image_url is available, otherwise fall back to SVG mode
          if (currentOverlayPack.image_url) {
            return (
              <>
                <ImageOverlayRenderer
                  imageUrl={currentOverlayPack.image_url}
                  screenDimensions={screenDimensions}
                  overlayMode={overlayMode}
                  motionSensitivity={motionSensitivity}
                  enableMotionEffects={enableMotionEffects}
                />
                {/* Keep polygon highlights on top for interactive parts */}
                <WorkspaceOverlayRenderer
                  overlayPack={currentOverlayPack}
                  activePartName={activePartName}
                  screenDimensions={screenDimensions}
                  cutawayMode={cutawayMode}
                  animationEnabled={!isPaused}
                  overlayMode={overlayMode}
                  motionSensitivity={motionSensitivity}
                  enableMotionEffects={enableMotionEffects}
                  hideWorkspaceSvg={true}
                />
              </>
            );
          } else {
            // Legacy SVG mode
            return (
              <WorkspaceOverlayRenderer
                overlayPack={currentOverlayPack}
                activePartName={activePartName}
                screenDimensions={screenDimensions}
                cutawayMode={cutawayMode}
                animationEnabled={!isPaused}
                overlayMode={overlayMode}
                motionSensitivity={motionSensitivity}
                enableMotionEffects={enableMotionEffects}
              />
            );
          }
        } else {
          // On-screen debug panel to make missing state obvious during diagnosis
          return (
            <View style={{ position: 'absolute', top: 100, left: 20, right: 20, padding: 12, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.9)', zIndex: 2000 }}>
              <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 4 }}>Overlay not rendered</Text>
              <Text style={{ color: '#fff' }}>overlayEnabled: {String(overlayEnabled)}</Text>
              <Text style={{ color: '#fff' }}>hasOverlayPack: {String(!!currentOverlayPack)}</Text>
              <Text style={{ color: '#fff' }}>hasCurrentStep: {String(!!currentStep)}</Text>
              <Text style={{ color: '#fff' }}>overlayPackId: {currentOverlayPack?.id || 'null'}</Text>
              <Text style={{ color: '#fff' }}>workspaceSvg: {currentOverlayPack?.workspace_svg ? `Present (${currentOverlayPack.workspace_svg.length} chars)` : 'Missing'}</Text>
            </View>
          );
        }
      })()}

      {/* Enhanced Overlay Controls */}
      <View style={styles.overlayControls}>
        {/* Overlay Mode Toggle */}
        <TouchableOpacity
          style={[
            styles.overlayButton,
            { backgroundColor: overlayMode === 'fake3d' ? '#00FFFF' : '#6B7280' }
          ]}
          onPress={toggleOverlayMode}
        >
          <Text style={[
            styles.overlayButtonText,
            { color: overlayMode === 'fake3d' ? '#000000' : '#FFFFFF' }
          ]}>
            {overlayMode === 'fake3d' ? '3D' : '2D'}
          </Text>
        </TouchableOpacity>

        {/* Motion Effects Toggle */}
        <TouchableOpacity
          style={[
            styles.overlayButton,
            { backgroundColor: enableMotionEffects ? '#16A34A' : '#6B7280' }
          ]}
          onPress={toggleMotionEffects}
        >
          <Text style={[
            styles.overlayButtonText,
            { color: '#FFFFFF' }
          ]}>
            {enableMotionEffects ? '📱' : '🔒'}
          </Text>
        </TouchableOpacity>

        {/* Motion Sensitivity Adjustment */}
        <TouchableOpacity
          style={[
            styles.overlayButton,
            { backgroundColor: '#F59E0B' }
          ]}
          onPress={adjustMotionSensitivity}
        >
          <Text style={[
            styles.overlayButtonText,
            { color: '#FFFFFF', fontSize: 12 }
          ]}>
            {motionSensitivity}x
          </Text>
        </TouchableOpacity>

        {/* Cutaway Mode Toggle */}
        <TouchableOpacity
          style={[
            styles.overlayButton,
            { backgroundColor: cutawayMode ? '#DC2626' : '#6B7280' }
          ]}
          onPress={() => setCutawayMode(!cutawayMode)}
        >
          <Text style={[
            styles.overlayButtonText,
            { color: '#FFFFFF' }
          ]}>
            {cutawayMode ? '👁️' : '🔍'}
          </Text>
        </TouchableOpacity>

        {/* Overlay Visibility Toggle */}
        <TouchableOpacity
          style={[
            styles.overlayButton,
            { backgroundColor: overlayEnabled ? '#2563EB' : '#6B7280' }
          ]}
          onPress={() => setOverlayEnabled(!overlayEnabled)}
        >
          <Text style={[
            styles.overlayButtonText,
            { color: '#FFFFFF' }
          ]}>
            {overlayEnabled ? '👻' : '❌'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Layer 1 (Top): Top Pill HUD with Step + Instruction */}
      <View style={styles.topHudContainer}>
        <View style={styles.stepPillContainer}>
          <Text style={styles.stepPillNumber}>Step {currentStepIndex + 1} of {repairTask.steps.length}</Text>
          <Text style={styles.stepPillInstruction}>{currentStep?.instruction}</Text>
          {currentStep?.toolRequired && (
            <Text style={styles.stepPillTool}>🔧 {currentStep.toolRequired}</Text>
          )}
        </View>
      </View>
        
      {/* Debug overlay state */}
      {(() => {
        console.log('🔍 Overlay render state:', {
          overlayEnabled,
          overlayPackExists: !!currentOverlayPack,
          activePartName: getCurrentPartName(),
          screenDimensions,
          cutawayMode
        });
        return null;
      })()}

      {/* Enhanced Step Info with 3D Mode Indicator */}
      {currentStep && (
        <View style={styles.stepInfoContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>
              Step {currentStepIndex + 1} of {repairTask.steps.length}
            </Text>
            <View style={styles.modeIndicator}>
              <Text style={styles.modeText}>
                {overlayMode === 'fake3d' ? '3D Mode' : '2D Mode'}
              </Text>
              {overlayMode === 'fake3d' && enableMotionEffects && (
                <Text style={styles.motionText}>Motion: {motionSensitivity}x</Text>
              )}
            </View>
          </View>
          {currentStep.toolRequired && (
            <Text style={styles.toolRequired}>Tool: {currentStep.toolRequired}</Text>
          )}
        </View>
      )}
        
      {/* Voice Status Indicator */}
      <View style={styles.voiceStatusContainer}>
        <View style={[
          styles.voiceStatusIndicator,
          { 
            backgroundColor: isListeningForSpeech ? '#16A34A' : 
                           isProcessingVoice ? '#F59E0B' : '#6B7280'
          }
        ]} />
        <Text style={styles.voiceStatusText}>
          {isListeningForSpeech ? 'Listening...' : 
           isProcessingVoice ? 'Processing...' : 'Voice Ready'}
        </Text>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseButton]}
          onPress={handlePauseResume}
        >
          {isPaused ? (
            <Play size={24} color="#FFFFFF" />
          ) : (
            <Pause size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.nextButton]}
          onPress={handleNextStep}
        >
          <SkipForward size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endButton]}
          onPress={handleEndSession}
        >
          <Square size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.volumeButton]}
          onPress={() => setSpeechEnabled(!speechEnabled)}
        >
          {speechEnabled ? (
            <Volume2 size={24} color="#FFFFFF" />
          ) : (
            <VolumeX size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Speech Prompt for Web */}
      {showSpeechPrompt && (
        <View style={styles.speechPromptContainer}>
          <Text style={styles.speechPromptText}>
            Enable speech for voice-guided repair instructions
          </Text>
          <TouchableOpacity style={styles.enableSpeechButton} onPress={enableSpeech}>
            <Text style={styles.enableSpeechButtonText}>Enable Speech</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    flex: 1,
  },
  ghostOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  highlightOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  topHudContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 3,
  },
  stepPillContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 12,
  },
  stepPillNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stepPillInstruction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  stepPillTool: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 2,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  voiceStatusContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  voiceStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  stepInfoContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 12,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  toolRequired: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '500',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
  },
  nextButton: {
    backgroundColor: '#16A34A',
  },
  endButton: {
    backgroundColor: '#DC2626',
  },
  volumeButton: {
    backgroundColor: '#6B7280',
  },
  speechPromptContainer: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  speechPromptText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  enableSpeechButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  enableSpeechButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayControls: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  overlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIndicator: {
    alignItems: 'flex-end',
  },
  modeText: {
    color: '#00FFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  motionText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '500',
  },
});
