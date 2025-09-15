import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Bot } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { RepairTask, OverlayPack } from '@/types';
import { getRepairTaskWithOverlay } from '@/services/repairService';
import { LemonFoxTtsService } from '@/services/lemonFoxTtsService';
import { RepairAIService } from '@/services/repairAIService';

interface RepairLoadingScreenProps {
  repairTaskId: string;
  vehicleVin: string;
  onLoadingComplete: (repairTask: RepairTask, overlayPack: OverlayPack | null) => void;
  onError: (error: string) => void;
}

export default function RepairLoadingScreen({
  repairTaskId,
  vehicleVin,
  onLoadingComplete,
  onError,
}: RepairLoadingScreenProps) {
  const { colors } = useTheme();
  const [progress, setProgress] = useState(1);
  const [currentTask, setCurrentTask] = useState('Initializing...');
  const [loadedRepairTask, setLoadedRepairTask] = useState<RepairTask | null>(null);
  const [loadedOverlayPack, setLoadedOverlayPack] = useState<OverlayPack | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const styles = createStyles(colors);

  // Start animations
  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Scale in animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Continuous rotation animation
    const rotateSequence = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    rotateSequence.start();

    // Pulse animation
    const pulseSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseSequence.start();

    return () => {
      rotateSequence.stop();
      pulseSequence.stop();
    };
  }, []);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Smooth progress animation
  useEffect(() => {
    if (isCompleted) return;

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          // Stop at 95% until completion
          return prev;
        }
        // Gradually increase progress (slower as it gets higher)
        const increment = prev < 30 ? 2 : prev < 60 ? 1.5 : prev < 80 ? 1 : 0.5;
        return Math.min(95, prev + increment);
      });
    }, 200); // Update every 200ms

    return () => clearInterval(progressInterval);
  }, [isCompleted]);

  // Start loading sequence
  useEffect(() => {
    startLoadingSequence();
  }, [repairTaskId, vehicleVin]);

  const startLoadingSequence = async () => {
    try {
      // Update task descriptions as progress continues
      setTimeout(() => setCurrentTask('Loading repair instructions...'), 500);
      setTimeout(() => setCurrentTask('Decoding vehicle information...'), 3000);
      setTimeout(() => setCurrentTask('Generating AR overlay...'), 8000);
      setTimeout(() => setCurrentTask('Initializing AI assistant...'), 15000);
      setTimeout(() => setCurrentTask('Setting up voice guidance...'), 20000);
      
      // This is the main async operation - loading repair task and overlay
      const { repairTask, overlayPack } = await getRepairTaskWithOverlay(repairTaskId);
      
      if (!repairTask) {
        throw new Error(`Failed to load repair task with ID: ${repairTaskId}`);
      }
      
      setLoadedRepairTask(repairTask);
      setLoadedOverlayPack(overlayPack);

      // Initialize AI assistant (synchronous)
      const repairAI = RepairAIService.getInstance();
      repairAI.clearConversation();

      // Initialize TTS service (synchronous)
      const ttsService = LemonFoxTtsService.getInstance();

      // Complete the progress
      setIsCompleted(true);
      setCurrentTask('Ready to start!');
      setProgress(100);

      // Wait a moment at 100% before transitioning
      setTimeout(() => {
        onLoadingComplete(repairTask, overlayPack);
      }, 800);

    } catch (error) {
      console.error('❌ Loading sequence failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      onError(errorMessage);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      {/* Robot Icon with Animations */}
      <View style={styles.iconContainer}>
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { scale: pulseAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <View style={[styles.iconBackground, { backgroundColor: colors.primary + '20' }]}>
            <Bot size={80} color={colors.primary} />
          </View>
        </Animated.View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>
        Preparing Repair Session
      </Text>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.progressBar,
              { 
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }
            ]}
          />
          <View style={styles.progressGlow} />
        </View>
        
        <Text style={[styles.progressText, { color: colors.text }]}>
          {Math.round(progress)}%
        </Text>
      </View>

      {/* Floating particles effect */}
      <View style={styles.particlesContainer}>
        {[...Array(6)].map((_, index) => (
          <FloatingParticle
            key={index}
            delay={index * 300}
            color={colors.primary}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Floating particle component for ambient effect
function FloatingParticle({ delay, color }: { delay: number; color: string }) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  
  // Store stable random position values
  const position = React.useRef({
    left: Math.random() * Dimensions.get('window').width,
    top: Dimensions.get('window').height * 0.8,
  }).current;

  const particleStyles = StyleSheet.create({
    particle: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      left: position.left,
      top: position.top,
    },
  });

  useEffect(() => {
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -100,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    setTimeout(startAnimation, delay);
  }, [delay]);

  return (
    <Animated.View
      style={[
        particleStyles.particle,
        {
          backgroundColor: color,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'relative',
    zIndex: 3,
  },
  iconBackground: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  orbitalRing: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 1000,
    borderStyle: 'dashed',
  },
  ring1: {
    width: 200,
    height: 200,
    top: -30,
    left: -30,
  },
  ring2: {
    width: 260,
    height: 260,
    top: -60,
    left: -60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 60,
    letterSpacing: 0.5,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
  },
  progressContainer: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  progressGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 6,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  progressText: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});