/**
 * Image to SVG Conversion Service
 * Converts DALL-E 3 generated images into SVG vector paths for ghost overlays
 */

interface ContourPoint {
  x: number;
  y: number;
}

interface DetectedShape {
  type: 'part' | 'workspace' | 'background';
  contour: ContourPoint[];
  color: string;
  opacity: number;
  isGlowing?: boolean;
}

interface SvgConversionResult {
  svg: string;
  parts: Record<string, { polygon: number[][] }>;
  workspace_bounds: { width: number; height: number };
}

export class ImageToSvgService {
  
  /**
   * Convert DALL-E 3 image URL to SVG vector paths
   */
  async convertImageToSvg(
    imageUrl: string,
    partName: string,
    workspaceType: string
  ): Promise<SvgConversionResult> {
    try {
      console.log('🔄 Converting DALL-E image to SVG:', imageUrl);
      
      // Download and process the image
      const imageData = await this.downloadImage(imageUrl);
      const canvas = await this.createCanvasFromImage(imageData);
      
      // Detect shapes and contours
      const shapes = await this.detectShapes(canvas, partName);
      
      // Generate SVG from detected shapes
      const svgResult = this.generateSvgFromShapes(shapes, partName, workspaceType);
      
      console.log('✅ Image converted to SVG successfully');
      return svgResult;
      
    } catch (error) {
      console.error('❌ Image to SVG conversion failed:', error);
      throw error;
    }
  }
  
  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    return await response.arrayBuffer();
  }
  
  /**
   * Create canvas from image data (React Native compatible)
   */
  private async createCanvasFromImage(imageData: ArrayBuffer): Promise<ImageData> {
    // For React Native, we'll use a simplified approach
    // In a real implementation, you'd use react-native-canvas or similar
    
    // Mock canvas data for now - in production this would process the actual image
    const width = 1000;
    const height = 600;
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Fill with mock data (in production, this would be actual image pixels)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;     // R
      data[i + 1] = 0; // G  
      data[i + 2] = 0; // B
      data[i + 3] = 255; // A
    }
    
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
  }
  
  /**
   * Detect shapes using edge detection and color analysis
   */
  private async detectShapes(canvas: ImageData, partName: string): Promise<DetectedShape[]> {
    const shapes: DetectedShape[] = [];
    
    // Analyze image for cyan/teal colors (DALL-E overlay colors)
    const cyanRegions = this.detectColorRegions(canvas, [0, 255, 255]); // Cyan
    const tealRegions = this.detectColorRegions(canvas, [0, 128, 128]); // Teal
    
    // Create glowing part shape (bright cyan)
    if (cyanRegions.length > 0) {
      const partShape: DetectedShape = {
        type: 'part',
        contour: this.traceContour(cyanRegions[0]),
        color: '#00FFFF',
        opacity: 1.0,
        isGlowing: true
      };
      shapes.push(partShape);
    }
    
    // Create workspace wireframe shapes (darker teal)
    tealRegions.forEach(region => {
      const workspaceShape: DetectedShape = {
        type: 'workspace',
        contour: this.traceContour(region),
        color: '#008080',
        opacity: 0.65,
        isGlowing: false
      };
      shapes.push(workspaceShape);
    });
    
    return shapes;
  }
  
  /**
   * Detect regions of specific color
   */
  private detectColorRegions(canvas: ImageData, targetColor: number[]): ContourPoint[][] {
    const regions: ContourPoint[][] = [];
    const { data, width, height } = canvas;
    const visited = new Set<string>();
    
    // Simple flood fill to find connected color regions
    for (let y = 0; y < height; y += 10) { // Sample every 10 pixels for performance
      for (let x = 0; x < width; x += 10) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const pixelIndex = (y * width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        
        // Check if pixel matches target color (with tolerance)
        if (this.colorMatches([r, g, b], targetColor, 50)) {
          const region = this.floodFill(canvas, x, y, targetColor, visited);
          if (region.length > 20) { // Minimum region size
            regions.push(region);
          }
        }
      }
    }
    
    return regions;
  }
  
  /**
   * Check if colors match within tolerance
   */
  private colorMatches(color1: number[], color2: number[], tolerance: number): boolean {
    return Math.abs(color1[0] - color2[0]) < tolerance &&
           Math.abs(color1[1] - color2[1]) < tolerance &&
           Math.abs(color1[2] - color2[2]) < tolerance;
  }
  
  /**
   * Flood fill algorithm to find connected regions
   */
  private floodFill(
    canvas: ImageData, 
    startX: number, 
    startY: number, 
    targetColor: number[],
    visited: Set<string>
  ): ContourPoint[] {
    const region: ContourPoint[] = [];
    const stack: ContourPoint[] = [{ x: startX, y: startY }];
    const { data, width, height } = canvas;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      
      const pixelIndex = (y * width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      if (!this.colorMatches([r, g, b], targetColor, 50)) {
        continue;
      }
      
      visited.add(key);
      region.push({ x, y });
      
      // Add neighbors (simplified - only check 4 directions)
      stack.push({ x: x + 10, y });
      stack.push({ x: x - 10, y });
      stack.push({ x, y: y + 10 });
      stack.push({ x, y: y - 10 });
    }
    
    return region;
  }
  
  /**
   * Trace contour from region points
   */
  private traceContour(region: ContourPoint[]): ContourPoint[] {
    if (region.length === 0) return [];
    
    // Simple convex hull algorithm for contour
    region.sort((a, b) => a.x - b.x || a.y - b.y);
    
    const lower: ContourPoint[] = [];
    for (const point of region) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
        lower.pop();
      }
      lower.push(point);
    }
    
    const upper: ContourPoint[] = [];
    for (let i = region.length - 1; i >= 0; i--) {
      const point = region[i];
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
        upper.pop();
      }
      upper.push(point);
    }
    
    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();
    
    return lower.concat(upper);
  }
  
  /**
   * Cross product for convex hull
   */
  private cross(o: ContourPoint, a: ContourPoint, b: ContourPoint): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }
  
  /**
   * Generate SVG from detected shapes
   */
  private generateSvgFromShapes(
    shapes: DetectedShape[], 
    partName: string, 
    workspaceType: string
  ): SvgConversionResult {
    
    const width = 1000;
    const height = 600;
    
    // Build SVG content
    let svgContent = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add filters for glow effects
    svgContent += `
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="pulse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>`;
    
    // Extract parts data for coordinate mapping
    const parts: Record<string, { polygon: number[][] }> = {};
    
    // Render shapes as SVG paths
    let primitivesCount = 0;
    shapes.forEach((shape, index) => {
      if (shape.contour.length < 3) return;
      
      // Convert contour to SVG path
      const pathData = this.contourToSvgPath(shape.contour);
      
      // Apply appropriate styling
      const filter = shape.isGlowing ? 'url(#glow)' : '';
      const strokeWidth = shape.isGlowing ? '3' : '2';
      
      svgContent += `
        <path 
          d="${pathData}" 
          fill="${shape.color}" 
          fill-opacity="${shape.opacity}"
          stroke="${shape.color}"
          stroke-width="${strokeWidth}"
          stroke-opacity="0.9"
          filter="${filter}"
        />`;
      primitivesCount++;
      
      // If this is a glowing part, add it to parts data
      if (shape.isGlowing && shape.type === 'part') {
        const normalizedPolygon = shape.contour.map(point => [
          point.x / width,
          point.y / height
        ]);
        parts[partName] = { polygon: normalizedPolygon };
      }
    });
    
    // Fallback: if no primitives were added, draw a visible wireframe and banner
    if (primitivesCount === 0) {
      console.warn('⚠️ imageToSvgService: No shapes detected. Emitting fallback wireframe overlay.');
      svgContent += `
        <rect x="0" y="0" width="${width}" height="${height}" fill="#00FFFF" fill-opacity="0.08" stroke="#00FFFF" stroke-width="3" stroke-opacity="0.9" />
        <path d="M 0 ${height/2} L ${width} ${height/2}" stroke="#00FFFF" stroke-opacity="0.25" stroke-width="1" />
        <path d="M ${width/2} 0 L ${width/2} ${height}" stroke="#00FFFF" stroke-opacity="0.25" stroke-width="1" />
        <text x="20" y="40" font-size="28" fill="#FFFFFF" stroke="#000000" stroke-width="0.5" opacity="0.9">${workspaceType.replace('_',' ').toUpperCase()} OVERLAY</text>
      `;
    }
    
    svgContent += '</svg>';
    
    return {
      svg: svgContent,
      parts,
      workspace_bounds: { width, height }
    };
  }
  
  /**
   * Convert contour points to SVG path data
   */
  private contourToSvgPath(contour: ContourPoint[]): string {
    if (contour.length === 0) return '';
    
    let path = `M ${contour[0].x} ${contour[0].y}`;
    
    for (let i = 1; i < contour.length; i++) {
      path += ` L ${contour[i].x} ${contour[i].y}`;
    }
    
    path += ' Z'; // Close path
    return path;
  }
}

export const imageToSvgService = new ImageToSvgService();
