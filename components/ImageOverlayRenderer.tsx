import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { useDeviceMotion, TiltData } from '@/services/deviceMotionService';

export type OverlayMode = 'flat' | 'fake3d';

interface ImageOverlayRendererProps {
  imageUrl: string;
  screenDimensions: { width: number; height: number };
  overlayMode?: OverlayMode;
  motionSensitivity?: number;
  enableMotionEffects?: boolean;
}

export default function ImageOverlayRenderer({
  imageUrl,
  screenDimensions,
  overlayMode = 'flat',
  motionSensitivity = 1.0,
  enableMotionEffects = true
}: ImageOverlayRendererProps) {
  
  const overlayTransform = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const overlayRotation = useRef(new Animated.Value(0)).current;
  
  // Get device motion data for fake 3D effects
  const { tilt, isAvailable: motionAvailable } = useDeviceMotion({
    sensitivity: motionSensitivity,
    smoothing: 0.8
  });
  
  // Apply motion-reactive transforms for fake 3D effect
  useEffect(() => {
    if (!enableMotionEffects || overlayMode === 'flat' || !motionAvailable) return;
    
    // Calculate perspective transforms based on device tilt
    const maxTilt = 15; // Maximum rotation in degrees
    const rotateX = tilt.x * maxTilt;
    const rotateY = tilt.y * maxTilt;
    const translateX = tilt.y * 20; // Parallax effect
    const translateY = tilt.x * 20;
    
    // Animate overlay transforms smoothly
    Animated.parallel([
      Animated.timing(overlayTransform.x, {
        toValue: translateX,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(overlayTransform.y, {
        toValue: translateY,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(overlayRotation, {
        toValue: rotateY * 0.5, // Subtle rotation effect
        duration: 100,
        useNativeDriver: false,
      })
    ]).start();
  }, [tilt, overlayMode, enableMotionEffects, motionAvailable]);
  
  // Don't render if screen dimensions not ready
  if (screenDimensions.width === 0 || screenDimensions.height === 0) {
    return null;
  }
  
  // Calculate overlay opacity based on overlay mode
  const overlayOpacity = overlayMode === 'fake3d' ? 0.55 : 0.65;
  
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]} pointerEvents="none">
      <Animated.View 
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: overlayOpacity,
            zIndex: 1001,
            transform: overlayMode === 'fake3d' && enableMotionEffects ? [
              { perspective: 1000 },
              { translateX: overlayTransform.x },
              { translateY: overlayTransform.y },
              { rotateY: overlayRotation.interpolate({
                inputRange: [-15, 15],
                outputRange: ['-15deg', '15deg']
              }) as any },
              { rotateX: overlayTransform.y.interpolate({
                inputRange: [-20, 20],
                outputRange: ['10deg', '-10deg']
              }) as any }
            ] : []
          }
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.overlayImage}
          resizeMode="contain"
          onLoad={() => {
            console.log('✅ PNG overlay loaded successfully');
          }}
          onError={(error) => {
            console.error('🚨 PNG overlay loading error:', error);
          }}
        />
        
        {/* Fake 3D depth overlay gradient */}
        {overlayMode === 'fake3d' && (
          <View style={[StyleSheet.absoluteFillObject, styles.depthOverlay]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayImage: {
    width: '100%',
    height: '100%',
  },
  depthOverlay: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)', // Subtle cyan tint for depth
    borderRadius: 8,
  },
});
