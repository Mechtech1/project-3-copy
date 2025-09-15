import React from 'react';
import { Animated } from 'react-native';
import Svg, { 
  Polygon, 
  Defs, 
  LinearGradient, 
  Stop, 
  Filter, 
  FeGaussianBlur, 
  FeMerge, 
  FeMergeNode,
  FeDropShadow,
  FeColorMatrix,
  G
} from 'react-native-svg';
import { OverlayPart } from '@/types';
import { TiltData } from '@/services/deviceMotionService';

export type OverlayMode = 'flat' | 'fake3d';

export interface OverlayPartRendererProps {
  part: OverlayPart;
  screenPoints: string;
  isActive: boolean;
  overlayMode: OverlayMode;
  tilt: TiltData;
  pulseAnimation?: Animated.Value;
  opacity?: number;
}

export default function OverlayPartRenderer({
  part,
  screenPoints,
  isActive,
  overlayMode,
  tilt,
  pulseAnimation,
  opacity = 1
}: OverlayPartRendererProps) {

  // Calculate depth-based lighting effects
  const calculateLightingEffects = () => {
    if (overlayMode === 'flat') {
      return {
        shadowOffset: { x: 0, y: 0 },
        lightDirection: 0,
        depthIntensity: 0
      };
    }

    // Use tilt data to simulate light direction
    const lightDirection = Math.atan2(tilt.y, tilt.x) * (180 / Math.PI);
    const depthIntensity = Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y) * 0.5;
    
    // Calculate shadow offset based on tilt
    const shadowOffset = {
      x: tilt.y * 8, // Horizontal shadow based on roll
      y: tilt.x * 8  // Vertical shadow based on pitch
    };

    return { shadowOffset, lightDirection, depthIntensity };
  };

  const { shadowOffset, lightDirection, depthIntensity } = calculateLightingEffects();

  // Generate unique IDs for filters and gradients
  const partId = (part.part_type || 'part').replace(/\s+/g, '').toLowerCase();
  const glowFilterId = `glow-${partId}`;
  const depthGradientId = `depth-${partId}`;
  const shadowFilterId = `shadow-${partId}`;
  const pulseFilterId = `pulse-${partId}`;

  // Calculate gradient colors based on lighting
  const baseColor = part.glow_color || '#00FFFF';
  const lightColor = adjustColorBrightness(baseColor, 0.3);
  const darkColor = adjustColorBrightness(baseColor, -0.2);

  return (
    <G opacity={opacity}>
      <Defs>
        {/* Depth gradient for 3D effect */}
        <LinearGradient
          id={depthGradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientTransform={`rotate(${lightDirection + 45})`}
        >
          <Stop offset="0%" stopColor={lightColor} stopOpacity="0.4" />
          <Stop offset="50%" stopColor={baseColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={darkColor} stopOpacity="0.1" />
        </LinearGradient>

        {/* Enhanced glow filter for fake 3D */}
        <Filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation={overlayMode === 'fake3d' ? "6" : "4"} result="coloredBlur"/>
          <FeMerge>
            <FeMergeNode in="coloredBlur"/>
            <FeMergeNode in="SourceGraphic"/>
          </FeMerge>
        </Filter>

        {/* Drop shadow filter for depth */}
        <Filter id={shadowFilterId} x="-100%" y="-100%" width="300%" height="300%">
          <FeDropShadow
            dx={shadowOffset.x}
            dy={shadowOffset.y}
            stdDeviation={overlayMode === 'fake3d' ? "4" : "2"}
            floodColor={darkColor}
            floodOpacity={overlayMode === 'fake3d' ? depthIntensity * 0.6 : 0.3}
          />
        </Filter>

        {/* Pulse glow filter for active parts */}
        {isActive && (
          <Filter id={pulseFilterId} x="-100%" y="-100%" width="300%" height="300%">
            <FeGaussianBlur stdDeviation="12" result="coloredBlur"/>
            <FeColorMatrix
              in="coloredBlur"
              type="matrix"
              values={`1 0 0 0 0
                       0 1 0 0 0
                       0 0 1 0 0
                       0 0 0 ${overlayMode === 'fake3d' ? 0.8 : 0.6} 0`}
            />
            <FeMerge>
              <FeMergeNode in="coloredBlur"/>
              <FeMergeNode in="SourceGraphic"/>
            </FeMerge>
          </Filter>
        )}
      </Defs>

      {/* Base part polygon with depth effects */}
      <Polygon
        points={screenPoints}
        fill={overlayMode === 'fake3d' ? `url(#${depthGradientId})` : `${baseColor}30`}
        stroke={baseColor}
        strokeWidth={overlayMode === 'fake3d' ? "2" : "3"}
        filter={`url(#${shadowFilterId})`}
      />

      {/* Enhanced glow layer */}
      <Polygon
        points={screenPoints}
        fill="none"
        stroke={baseColor}
        strokeWidth={overlayMode === 'fake3d' ? "1.5" : "2"}
        filter={`url(#${glowFilterId})`}
        opacity={overlayMode === 'fake3d' ? 0.9 : 0.7}
      />

      {/* Active part pulse animation */}
      {isActive && pulseAnimation && (
        <Animated.View style={{ 
          transform: [{ 
            scale: pulseAnimation.interpolate({
              inputRange: [1, 1.3],
              outputRange: [1, overlayMode === 'fake3d' ? 1.2 : 1.3]
            }) 
          }] 
        }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Polygon
              points={screenPoints}
              fill="none"
              stroke={baseColor}
              strokeWidth={overlayMode === 'fake3d' ? "3" : "2"}
              filter={`url(#${pulseFilterId})`}
              opacity={overlayMode === 'fake3d' ? 0.8 : 0.6}
            />
          </Svg>
        </Animated.View>
      )}

      {/* Inner highlight for 3D bevel effect */}
      {overlayMode === 'fake3d' && (
        <Polygon
          points={screenPoints}
          fill="none"
          stroke={lightColor}
          strokeWidth="1"
          opacity={0.4 + depthIntensity * 0.3}
          strokeDasharray="3,2"
        />
      )}

      {/* Accessibility indicator with 3D effects */}
      {part.accessibility === 'difficult' && (
        <G>
          {/* Warning triangle with depth */}
          <Polygon
            points={generateWarningTriangle(screenPoints)}
            fill={overlayMode === 'fake3d' ? `url(#${depthGradientId})` : '#FF6B35'}
            stroke="#FFFFFF"
            strokeWidth="2"
            filter={`url(#${shadowFilterId})`}
          />
          {overlayMode === 'fake3d' && (
            <Polygon
              points={generateWarningTriangle(screenPoints)}
              fill="none"
              stroke="#FFB35A"
              strokeWidth="1"
              opacity="0.6"
            />
          )}
        </G>
      )}
    </G>
  );
}

// Helper function to adjust color brightness
function adjustColorBrightness(color: string, amount: number): string {
  // Simple hex color brightness adjustment
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount * 255));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount * 255));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount * 255));
  
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

// Helper function to generate warning triangle points
function generateWarningTriangle(polygonPoints: string): string {
  // Extract first point from polygon for triangle placement
  const points = polygonPoints.split(' ');
  if (points.length < 2) return '';
  
  const x = parseFloat(points[0].split(',')[0]);
  const y = parseFloat(points[0].split(',')[1]);
  
  // Create small triangle above the part
  const size = 15;
  return `${x},${y - size} ${x - size},${y + size} ${x + size},${y + size}`;
}
