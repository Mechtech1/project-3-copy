import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import Svg, { 
  Polygon,
  Path, 
  Defs, 
  Filter, 
  FeGaussianBlur, 
  FeMerge, 
  FeMergeNode,
  G,
  LinearGradient,
  Stop
} from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { WorkspaceRendererProps } from '@/types';
import {
  calculateOverlayBounds,
  convertPolygonToScreenPoints,
  convertPolylineToScreenPath,
  validateNormalizedCoordinates
} from '@/utils/coordinateUtils';
import { useDeviceMotion, TiltData } from '@/services/deviceMotionService';
import OverlayPartRenderer, { OverlayMode } from './OverlayPartRenderer';

interface ExtendedWorkspaceRendererProps extends WorkspaceRendererProps {
  overlayMode?: OverlayMode;
  motionSensitivity?: number;
  enableMotionEffects?: boolean;
  hideWorkspaceSvg?: boolean; // Hide workspace SVG when using PNG overlay mode
}

// Toggle to enable verbose overlay render logging
const DEBUG_OVERLAY_RENDER = false;

export default function WorkspaceOverlayRenderer({
  overlayPack,
  activePartName,
  screenDimensions,
  cutawayMode = false,
  animationEnabled = true,
  overlayMode = 'flat',
  motionSensitivity = 1.0,
  enableMotionEffects = true,
  hideWorkspaceSvg = false
}: ExtendedWorkspaceRendererProps) {
  
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const pathAnimation = useRef(new Animated.Value(0)).current;
  const overlayTransform = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const overlayRotation = useRef(new Animated.Value(0)).current;
  
  // Get device motion data for fake 3D effects
  const { tilt, isAvailable: motionAvailable } = useDeviceMotion({
    sensitivity: motionSensitivity,
    smoothing: 0.8
  });
  
  // Calculate overlay bounds for coordinate conversion
  const overlayBounds = calculateOverlayBounds(screenDimensions, overlayPack.baseline_dimensions);
  
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
  
  // Start pulse animation for active part
  useEffect(() => {
    const activePart = overlayPack.parts[activePartName];
    if (!animationEnabled || !activePart) return;
    
    const pulseSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: overlayMode === 'fake3d' ? 1.2 : 1.3,
          duration: overlayMode === 'fake3d' ? 1000 : 800,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: overlayMode === 'fake3d' ? 1000 : 800,
          useNativeDriver: false,
        }),
      ])
    );
    
    pulseSequence.start();
    
    return () => pulseSequence.stop();
  }, [activePartName, animationEnabled, overlayMode, overlayPack.parts]);
  
  // Start path animation for access routes
  useEffect(() => {
    if (!animationEnabled || !overlayPack.access_paths?.[activePartName]) return;
    
    pathAnimation.setValue(0);
    
    const pathSequence = Animated.loop(
      Animated.timing(pathAnimation, {
        toValue: 1,
        duration: overlayPack.access_paths[activePartName]?.animation_duration || 3000,
        useNativeDriver: false,
      })
    );
    
    pathSequence.start();
    
    return () => pathSequence.stop();
  }, [activePartName, animationEnabled, overlayPack.access_paths]);
  
  // Always render workspace SVG - don't return null for missing activePart
  if (screenDimensions.width === 0 || screenDimensions.height === 0) {
    console.log('🔍 Screen dimensions not ready:', screenDimensions);
    return null;
  }
  
  // Get active part data (may be undefined)
  const activePart = overlayPack.parts[activePartName];
  
  // Calculate workspace opacity based on overlay mode
  const workspaceOpacity = overlayMode === 'fake3d' ? 0.55 : 0.65;
  
  // Log rendering state for debugging
  if (DEBUG_OVERLAY_RENDER) {
    console.log('🎨 Rendering workspace overlay:', {
      hasWorkspaceSvg: !!overlayPack.workspace_svg,
      hasActivePart: !!activePart,
      activePartName,
      workspaceOpacity
    });
  }
  
  // Detect visually-empty SVGs (e.g., only <defs> without primitives)
  const svgXml = overlayPack.workspace_svg || '';
  const hasVisiblePrimitives = /<\s*(path|polygon|rect|circle|ellipse|line|polyline)\b/i.test(svgXml);
  const hasOnlyDefs = /<svg[\s\S]*?<defs[\s\S]*?<\/defs>[\s\S]*?<\/svg>/i.test(svgXml) && !hasVisiblePrimitives;
  if (svgXml && (hasOnlyDefs || !hasVisiblePrimitives)) {
    console.warn('⚠️ Workspace SVG appears visually empty (no drawable primitives). Rendering fallback label.');
  }
  
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]} pointerEvents="none">
      {/* Render workspace SVG only when not hidden (PNG mode hides this) */}
      {!hideWorkspaceSvg && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: workspaceOpacity,
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
          {svgXml ? (
            hasOnlyDefs || !hasVisiblePrimitives ? (
              <Text style={{
                color: 'red',
                backgroundColor: 'white',
                padding: 10,
                fontSize: 16,
                fontWeight: 'bold'
              }}>
                EMPTY SVG CONTENT (defs-only)
              </Text>
            ) : (
              <SvgXml
                xml={svgXml}
                width="100%"
                height="100%"
                style={styles.workspaceSvg}
                onError={(error) => {
                  console.error('🚨 SVG rendering error:', error);
                }}
                onLoad={() => {
                  console.log('✅ SVG loaded successfully');
                }}
              />
            )
          ) : (
            <Text style={{
              color: 'red',
              backgroundColor: 'white',
              padding: 10,
              fontSize: 16,
              fontWeight: 'bold'
            }}>
              NO SVG DATA
            </Text>
          )}
          
          {/* Fake 3D depth overlay gradient */}
          {overlayMode === 'fake3d' && (
            <View style={[StyleSheet.absoluteFillObject, styles.depthOverlay]} />
          )}
        </Animated.View>
      )}
      
      {/* Only render part highlights if activePart exists */}
      {activePart && validateNormalizedCoordinates(activePart.polygon) && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFillObject,
            overlayMode === 'fake3d' && enableMotionEffects ? {
              transform: [
                { perspective: 1000 },
                { translateX: overlayTransform.x },
                { translateY: overlayTransform.y },
                { rotateY: overlayRotation.interpolate({
                  inputRange: [-15, 15],
                  outputRange: ['-8deg', '8deg']
                }) as any }
              ]
            } : {}
          ]}
        >
          <OverlayPartRenderer
            part={activePart}
            screenPoints={convertPolygonToScreenPoints(activePart.polygon, overlayBounds)}
            isActive={true}
            overlayMode={overlayMode}
            tilt={tilt}
            pulseAnimation={pulseAnimation}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  workspaceContainer: {
    position: 'absolute',
  },
  workspaceSvg: {
    opacity: 1,
  },
  depthOverlay: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)', // Subtle cyan tint for depth
    borderRadius: 8,
  },
});
