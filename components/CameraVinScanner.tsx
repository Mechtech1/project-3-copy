import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { Camera, X, Zap, ZapOff, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import TextRecognition from '@react-native-ml-kit/text-recognition';

interface CameraVinScannerProps {
  onVinDetected: (vin: string) => void;
  onClose: () => void;
}

export default function CameraVinScanner({ onVinDetected, onClose }: CameraVinScannerProps) {
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedVin, setDetectedVin] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { colors } = useTheme();

  const styles = createStyles(colors);

  // VIN validation regex - 17 characters, no I, O, Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;

  const validateVin = (text: string): boolean => {
    return vinRegex.test(text.toUpperCase());
  };

  const extractVinFromText = (text: string): string | null => {
    // Split text into words and check each for VIN pattern
    const words = text.replace(/[^A-Z0-9\s]/gi, '').split(/\s+/);
    
    for (const word of words) {
      const cleanWord = word.toUpperCase().trim();
      if (cleanWord.length === 17 && validateVin(cleanWord)) {
        return cleanWord;
      }
    }

    // Also check for continuous 17-character sequences
    const continuous = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    for (let i = 0; i <= continuous.length - 17; i++) {
      const sequence = continuous.substring(i, i + 17);
      if (validateVin(sequence)) {
        return sequence;
      }
    }

    return null;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isProcessing) return;

    setIsCapturing(true);
    try {
      console.log('📸 Capturing image for VIN detection...');
      
              const photo = await cameraRef.current.takePictureAsync({
          quality: 0.6, // Reduce quality to save memory
          base64: false,
          skipProcessing: false,
          exif: false, // Disable EXIF data to save memory
        });

              if (photo && photo.uri) {
          console.log('📸 Image captured, processing with ML Kit OCR...');
          setIsProcessing(true);
          
          // Add a small delay to let the camera settle and free up memory
          await new Promise(resolve => setTimeout(resolve, 200));
          
          await processImageForVin(photo.uri);
        }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Capture Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const processImageForVin = async (imageUri: string) => {
    try {
      console.log('🔍 Processing image with ML Kit Text Recognition...');
      
              // Add timeout to prevent hanging and memory issues
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Text recognition timeout - possible memory issue')), 8000)
        );
        
        const recognitionPromise = TextRecognition.recognize(imageUri);
        
        // Use ML Kit to extract text from image with timeout protection
        const result = await Promise.race([recognitionPromise, timeoutPromise]);
      
      console.log('🔍 ML Kit detected text blocks:', result.blocks.length);
      
      // Force garbage collection hint for memory cleanup
      if (global.gc) {
        global.gc();
      }
      
      // Combine all detected text
      let allText = '';
      result.blocks.forEach(block => {
        allText += block.text + ' ';
      });
      
      console.log('🔍 Combined detected text:', allText.substring(0, 200) + '...');
      
      // Extract VIN from detected text
      const detectedVin = extractVinFromText(allText);
      
      if (detectedVin) {
        console.log('✅ VIN detected:', detectedVin);
        setDetectedVin(detectedVin);
        setShowConfirmation(true);
      } else {
        console.log('❌ No valid VIN found in detected text');
        Alert.alert(
          'VIN Not Detected',
          'VIN not detected. Please try again or use manual entry.',
          [
            { text: 'Try Again', style: 'default' },
            { text: 'Manual Entry', onPress: onClose },
          ]
        );
      }
          } catch (error) {
        console.error('Error processing image with ML Kit:', error);
        
        // Handle specific error types that commonly cause crashes
        let errorTitle = 'Processing Error';
        let errorMessage = 'Failed to process image. Please try again or use manual entry.';
        
        if (error.message?.includes('timeout')) {
          errorTitle = 'Processing Timeout';
          errorMessage = 'Image processing is taking too long. This may indicate a memory issue. Please try with better lighting or restart the app.';
        } else if (error.message?.includes('memory') || error.message?.includes('OutOfMemory') || 
                   error.message?.includes('SIGSEGV') || error.message?.includes('native')) {
          errorTitle = 'Memory Error';
          errorMessage = 'Device is low on memory. Please close other apps and restart the camera scanner.';
        }
        
        Alert.alert(
          errorTitle,
          errorMessage,
          [
            { text: 'Try Again', style: 'default' },
            { text: 'Manual Entry', onPress: onClose },
          ]
        );
      } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmVin = () => {
    if (detectedVin) {
      setShowConfirmation(false);
      onVinDetected(detectedVin);
    }
  };

  const handleRetryCapture = () => {
    setShowConfirmation(false);
    setDetectedVin(null);
  };

  const toggleFlash = () => {
    setFlash(flash === 'off' ? 'on' : 'off');
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            We need camera access to scan your vehicle's VIN code
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
              Use Manual Entry Instead
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode="picture"
      >
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan VIN Code</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* VIN scanning guide overlay */}
        <View style={styles.scanGuide}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.guideText}>
            Position the VIN code within the frame
          </Text>
          <Text style={styles.guideSubtext}>
            Usually found on dashboard, door frame, or engine bay
          </Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.controls}>
          {/* Flashlight toggle */}
          <TouchableOpacity
            style={[styles.controlButton, flash === 'on' && styles.controlButtonActive]}
            onPress={toggleFlash}
          >
            {flash === 'on' ? (
              <Zap size={24} color="#FFFFFF" />
            ) : (
              <ZapOff size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Capture button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              (isCapturing || isProcessing) && styles.captureButtonDisabled
            ]}
            onPress={handleCapture}
            disabled={isCapturing || isProcessing}
          >
            {isCapturing || isProcessing ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Camera size={32} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Manual entry button */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={onClose}
          >
            <Text style={styles.manualText}>Manual</Text>
          </TouchableOpacity>
        </View>

        {/* Processing overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.processingText, { color: colors.text }]}>
                Detecting VIN...
              </Text>
              <Text style={[styles.processingSubtext, { color: colors.textSecondary }]}>
                Using ML Kit OCR to read text
              </Text>
            </View>
          </View>
        )}
      </CameraView>

      {/* VIN Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>VIN Detected</Text>
          </View>

          <View style={styles.modalContent}>
            <CheckCircle size={64} color={colors.success} style={styles.successIcon} />
            
            <Text style={[styles.confirmationTitle, { color: colors.text }]}>
              Detected VIN:
            </Text>
            
            <View style={[styles.vinDisplay, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.vinText, { color: colors.text }]}>
                {detectedVin}
              </Text>
            </View>

            <Text style={[styles.confirmationQuestion, { color: colors.textSecondary }]}>
              Is this VIN correct?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.retryButton, { borderColor: colors.border }]}
                onPress={handleRetryCapture}
              >
                <Text style={[styles.retryButtonText, { color: colors.text }]}>
                  Try Again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.success }]}
                onPress={handleConfirmVin}
              >
                <Text style={styles.confirmButtonText}>
                  Confirm VIN
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scanGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanFrame: {
    width: 280,
    height: 120,
    position: 'relative',
    marginBottom: 32,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  guideSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
    borderColor: '#FFC107',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(37, 99, 235, 0.6)',
  },
  manualText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 40,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: 32,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  vinDisplay: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    width: '100%',
  },
  vinText: {
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  confirmationQuestion: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    borderWidth: 0,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});