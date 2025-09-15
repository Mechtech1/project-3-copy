/**
 * Coordinate Conversion Utilities
 * Handles conversion between normalized coordinates and screen pixels
 */

import { PrecisionCoordinate } from '@/types';

/**
 * Converts normalized coordinate (0-1) to screen pixel coordinate
 */
export function convertNormalizedToScreen(
  normalizedCoord: PrecisionCoordinate,
  overlayBounds: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  return {
    x: overlayBounds.left + normalizedCoord.x * overlayBounds.width,
    y: overlayBounds.top + normalizedCoord.y * overlayBounds.height
  };
}

/**
 * Converts screen pixel coordinate to normalized coordinate (0-1)
 */
export function convertScreenToNormalized(
  screenCoord: { x: number; y: number },
  overlayBounds: { left: number; top: number; width: number; height: number }
): PrecisionCoordinate {
  return {
    x: Math.round(((screenCoord.x - overlayBounds.left) / overlayBounds.width) * 1000) / 1000,
    y: Math.round(((screenCoord.y - overlayBounds.top) / overlayBounds.height) * 1000) / 1000
  };
}

/**
 * Converts polygon of normalized coordinates to SVG points string
 */
export function convertPolygonToScreenPoints(
  polygon: PrecisionCoordinate[],
  overlayBounds: { left: number; top: number; width: number; height: number }
): string {
  return polygon
    .map(coord => {
      const screen = convertNormalizedToScreen(coord, overlayBounds);
      return `${Math.round(screen.x)},${Math.round(screen.y)}`;
    })
    .join(' ');
}

/**
 * Converts polyline of normalized coordinates to SVG path string
 */
export function convertPolylineToScreenPath(
  polyline: PrecisionCoordinate[],
  overlayBounds: { left: number; top: number; width: number; height: number }
): string {
  if (polyline.length === 0) return '';
  
  const screenPoints = polyline.map(coord => convertNormalizedToScreen(coord, overlayBounds));
  
  let path = `M ${Math.round(screenPoints[0].x)} ${Math.round(screenPoints[0].y)}`;
  
  for (let i = 1; i < screenPoints.length; i++) {
    path += ` L ${Math.round(screenPoints[i].x)} ${Math.round(screenPoints[i].y)}`;
  }
  
  return path;
}

/**
 * Calculates overlay bounds based on screen dimensions and aspect ratio
 */
export function calculateOverlayBounds(
  screenDimensions: { width: number; height: number },
  baselineDimensions: { width: number; height: number }
): { left: number; top: number; width: number; height: number } {
  
  const screenAspect = screenDimensions.width / screenDimensions.height;
  const overlayAspect = baselineDimensions.width / baselineDimensions.height;
  
  let overlayWidth: number;
  let overlayHeight: number;
  
  if (screenAspect > overlayAspect) {
    // Screen is wider than overlay - fit to height
    overlayHeight = screenDimensions.height;
    overlayWidth = overlayHeight * overlayAspect;
  } else {
    // Screen is taller than overlay - fit to width
    overlayWidth = screenDimensions.width;
    overlayHeight = overlayWidth / overlayAspect;
  }
  
  const left = (screenDimensions.width - overlayWidth) / 2;
  const top = (screenDimensions.height - overlayHeight) / 2;
  
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(overlayWidth),
    height: Math.round(overlayHeight)
  };
}

/**
 * Validates that coordinates are within normalized range (0-1)
 */
export function validateNormalizedCoordinates(coordinates: PrecisionCoordinate[]): boolean {
  return coordinates.every(coord => 
    typeof coord.x === 'number' && 
    typeof coord.y === 'number' &&
    coord.x >= 0 && coord.x <= 1 &&
    coord.y >= 0 && coord.y <= 1
  );
}

/**
 * Clamps coordinate to normalized range (0-1)
 */
export function clampNormalizedCoordinate(coord: PrecisionCoordinate): PrecisionCoordinate {
  return {
    x: Math.max(0, Math.min(1, Math.round(coord.x * 1000) / 1000)),
    y: Math.max(0, Math.min(1, Math.round(coord.y * 1000) / 1000))
  };
}

/**
 * Scales polygon by a factor around its center
 */
export function scalePolygon(
  polygon: PrecisionCoordinate[],
  scaleFactor: number
): PrecisionCoordinate[] {
  
  // Calculate centroid
  const centroid = polygon.reduce(
    (acc, coord) => ({
      x: acc.x + coord.x / polygon.length,
      y: acc.y + coord.y / polygon.length
    }),
    { x: 0, y: 0 }
  );
  
  // Scale around centroid
  return polygon.map(coord => ({
    x: centroid.x + (coord.x - centroid.x) * scaleFactor,
    y: centroid.y + (coord.y - centroid.y) * scaleFactor
  }));
}

/**
 * Tests if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(
  point: PrecisionCoordinate,
  polygon: PrecisionCoordinate[]
): boolean {
  
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calculates distance between two normalized coordinates
 */
export function calculateDistance(
  coord1: PrecisionCoordinate,
  coord2: PrecisionCoordinate
): number {
  const dx = coord2.x - coord1.x;
  const dy = coord2.y - coord1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the closest point on a polygon to a given coordinate
 */
export function findClosestPointOnPolygon(
  point: PrecisionCoordinate,
  polygon: PrecisionCoordinate[]
): { point: PrecisionCoordinate; distance: number } {
  
  let closestPoint = polygon[0];
  let minDistance = calculateDistance(point, polygon[0]);
  
  for (const coord of polygon) {
    const distance = calculateDistance(point, coord);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = coord;
    }
  }
  
  return { point: closestPoint, distance: minDistance };
}
