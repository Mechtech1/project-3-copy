/**
 * DeepSeek-DALL-E 3 Overlay Service
 * Combines DeepSeek technical planning with DALL-E 3 visual generation and SVG conversion
 */

import { rateLimitedChatCompletion } from './rateLimitService';
import { OverlayPack, OverlayPart, AccessPath, OverlayLayer } from '@/types';
import { imageToSvgService } from './imageToSvgService';
import { imageStorageService } from './imageStorageService';

let deepseekClient: any = null;
let openaiClient: any = null;

function getOpenAIClient(): any {
  if (!openaiClient) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_OPENAI_API_KEY environment variable is not set');
    }
    // Create a simple OpenAI-compatible client
    openaiClient = {
      images: {
        generate: async (params: any) => {
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
          }
          
          return await response.json();
        }
      }
    };
  }
  return openaiClient;
}

function getDeepSeekClient(): any {
  if (!deepseekClient) {
    const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_DEEPSEEK_API_KEY environment variable is not set');
    }
    deepseekClient = {
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    };
  }
  return deepseekClient;
}

interface TechnicalSpecification {
  visual_brief: {
    style: string;
    viewpoint: string;
    contrast_requirements: string;
    color_scheme: string;
    target_part: string;
    part_location: string;
  };
  layout_specifications: Record<string, {
    position: string;
    size: string;
    shape: string;
    color: string;
    stroke: string;
    highlight_method?: string;
    location_details?: string;
  }>;
  ar_optimization: {
    stroke_width: string;
    glow_effects: string;
    background: string;
    highlighting: string;
  };
  vehicle_specific_details: {
    engine_layout: string;
    part_accessibility: string;
    surrounding_obstacles: string;
    best_viewing_angle: string;
  };
}


interface DalleResponse {
  data: Array<{
    url: string;
  }>;
}

/**
 * DeepSeek-DALL-E 3 Overlay Service Class
 */
export class DeepSeekDalleOverlayService {
  
  /**
   * Phase 1: DeepSeek Technical Planning
   */
  async deepseekTechnicalPlanning(
    vehicleFamily: string,
    workspaceType: string,
    repairType: string,
    vehicleInfo?: { year?: number; make?: string; model?: string; engine?: string }
  ): Promise<TechnicalSpecification> {
    
    const vehicleContext = vehicleInfo ? 
      `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.engine ? `with ${vehicleInfo.engine} engine` : ''}` : 
      `${vehicleFamily} vehicle`;

    const prompt = `You are an automotive technical architect with expert knowledge of vehicle-specific part locations. Create detailed visual specifications for a ${vehicleContext} ${workspaceType} workspace overlay for ${repairType.replace(/_/g, ' ')} repair.

VEHICLE-SPECIFIC REQUIREMENTS:
- Use exact knowledge of ${vehicleContext} layout and part locations
- Specify precise positioning based on this vehicle's engine bay configuration
- Account for vehicle-specific access points and component placement

OVERLAY REQUIREMENTS:
- Canvas: 1000x600 baseline dimensions
- AR Camera Overlay: 65% opacity, high contrast colors
- Colors: Bright cyan (#00FFFF) primary, white (#FFFFFF) strokes, yellow (#FFFF00) secondary
- Single image showing: workspace background + highlighted target part

TARGET PART SPECIFICATION:
- Identify the exact location of the part being repaired in ${vehicleContext}
- Specify highlighting method (bright outline, glow effect, pulsing animation)
- Provide access path if part is difficult to reach

WORKSPACE LAYOUT:
- Show the specific engine bay view for ${vehicleContext}
- Include surrounding components for context
- Mark the target part with bright highlighting

Return ONLY a JSON object with this structure:
{
  "visual_brief": {
    "viewpoint": "engine_bay_front_view",
    "style": "technical_illustration",
    "contrast_requirements": "high_contrast_ar_optimized",
    "color_scheme": "cyan_white_yellow",
    "target_part": "specific_part_name",
    "part_location": "exact_description_of_location_in_this_vehicle"
  },
  "layout_specifications": {
    "workspace_background": {
      "position": "full_canvas",
      "color": "#FFFFFF",
      "opacity": "0.3",
      "description": "vehicle_specific_engine_bay_layout"
    },
    "target_part": {
      "position": "exact_coordinates_description",
      "color": "#FFFF00",
      "stroke": "#FFFFFF",
      "highlight_method": "bright_outline_with_glow",
      "size": "proportional_to_actual_part",
      "location_details": "specific_location_in_this_vehicle"
    },
    "surrounding_components": {
      "position": "contextual_placement",
      "color": "#00FFFF",
      "stroke": "#FFFFFF",
      "opacity": "0.6"
    }
  },
  "ar_optimization": {
    "stroke_width": "4px minimum for visibility",
    "glow_effects": "bright yellow glow on target part",
    "background": "semi-transparent white",
    "highlighting": "pulsing animation on target part"
  },
  "vehicle_specific_details": {
    "engine_layout": "specific_to_this_vehicle",
    "part_accessibility": "easy/moderate/difficult",
    "surrounding_obstacles": "list_of_nearby_components",
    "best_viewing_angle": "optimal_camera_position"
  }
}`;

    const client = getDeepSeekClient();
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    if (!content) {
      throw new Error('No technical specification from DeepSeek');
    }

    try {
      console.log('🔍 Raw DeepSeek response content:', content);
      
      // Try to extract JSON from the response if it contains extra text
      let jsonContent = content.trim();
      
      // Look for JSON object boundaries
      const jsonStart = jsonContent.indexOf('{');
      const jsonEnd = jsonContent.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd);
        console.log('🔍 Extracted JSON content:', jsonContent);
      }
      
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse technical specification:', error);
      console.error('Raw content that failed to parse:', content);
      throw new Error('Invalid technical specification JSON from DeepSeek');
    }
  }

  /**
   * Phase 2: DALL-E 3 Visual Generation (Direct PNG URL)
   */
  async dalleVisualGeneration(
    vehicleInfo: any,
    repairType: string,
    workspaceType: string,
    partName: string
  ): Promise<string> {
    console.log('🎨 Starting DALL-E 3 visual generation...');
    console.log('📊 Generation parameters:', {
      vehicleInfo: {
        year: vehicleInfo?.year,
        make: vehicleInfo?.make,
        model: vehicleInfo?.model,
        engine: vehicleInfo?.engine,
        bodyStyle: vehicleInfo?.bodyStyle,
        trim: vehicleInfo?.trim,
        drivetrain: vehicleInfo?.drivetrain,
        market: vehicleInfo?.market,
        steering: vehicleInfo?.steering
      },
      repairType,
      workspaceType,
      partName
    });
    
    try {
      // Always get vehicle-specific planning first so we can extract
      // exact location, side hint, and variant notes.
      const vehicleFamily = `${vehicleInfo?.make ?? ''} ${vehicleInfo?.model ?? ''}`.trim() || 'vehicle';
      console.log('🔄 Getting technical planning from DeepSeek...');
      const technicalSpec = await this.deepseekTechnicalPlanning(
        vehicleFamily,
        workspaceType,
        repairType,
        vehicleInfo
      );
      console.log('✅ Technical planning completed');

      // Derive exact part location and notes from planning output
      const exactPartLocation = (
        technicalSpec?.visual_brief?.part_location ||
        technicalSpec?.layout_specifications?.target_part?.location_details ||
        technicalSpec?.vehicle_specific_details?.engine_layout ||
        'center of the workspace'
      );

      const sideHint = this.extractSideHintFromText(exactPartLocation) || 'center';
      const knownVariantNotes = this.buildVariantNotes(technicalSpec, vehicleInfo) || 'no notable variant differences';

      const openai = getOpenAIClient();
      console.log('🔄 Calling DALL-E 3 API...');
      const prompt = buildDallePrompt(
        vehicleInfo,
        repairType,
        workspaceType,
        partName,
        sideHint,
        exactPartLocation,
        knownVariantNotes
      );
      
      console.log('🎨 DALL-E 3 prompt length:', prompt.length, 'characters');
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard"
      });

      console.log('📡 DALL-E 3 API response received');
      const result = response as DalleResponse;
      
      if (!result.data || !result.data[0] || !result.data[0].url) {
        throw new Error('No image URL from DALL-E 3');
      }

      const temporaryImageUrl = result.data[0].url;
      console.log('✅ DALL-E 3 temporary PNG overlay generated successfully');
      console.log('🔗 Temporary URL length:', temporaryImageUrl.length);
      
      // Store the image permanently in Supabase Storage
      console.log('💾 Storing image permanently in Supabase Storage...');
      const permanentImageUrl = await imageStorageService.storeDalleOverlayImage(
        temporaryImageUrl,
        vehicleFamily,
        workspaceType
      );
      
      console.log('✅ Image stored permanently:', permanentImageUrl);
      
      // Return the permanent PNG URL for ImageOverlayRenderer
      return permanentImageUrl;
      
    } catch (error) {
      console.error('❌ DALL-E 3 generation failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Phase 3: DeepSeek Coordinate Extraction
   */
  async deepseekCoordinateExtraction(
    workspaceSvg: string,
    technicalSpec: TechnicalSpecification
  ): Promise<Record<string, OverlayPart>> {
    
    const prompt = `Analyze this SVG and extract normalized coordinates (0.000-1.000) for each automotive component.

SVG Content: ${workspaceSvg.substring(0, 2000)}...

Technical Specification: ${JSON.stringify(technicalSpec, null, 2)}

Extract precise polygon coordinates for each component. Return ONLY a JSON object:

{
  "engine": {
    "polygon": [
      {"x": 0.350, "y": 0.250},
      {"x": 0.650, "y": 0.250}, 
      {"x": 0.650, "y": 0.500},
      {"x": 0.350, "y": 0.500}
    ],
    "glow_color": "#00FFFF",
    "part_type": "engine",
    "accessibility": "moderate"
  },
  "battery": {
    "polygon": [
      {"x": 0.100, "y": 0.150},
      {"x": 0.220, "y": 0.150},
      {"x": 0.220, "y": 0.230},
      {"x": 0.100, "y": 0.230}
    ],
    "glow_color": "#FF6B35", 
    "part_type": "electrical",
    "accessibility": "easy"
  }
}

Use 3 decimal precision (0.001) for exact part outlines. Include all components from the technical specification.`;

    const client = getDeepSeekClient();
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    if (!content) {
      throw new Error('No coordinate extraction from DeepSeek');
    }

    try {
      console.log('🔍 Raw DeepSeek response content:', content);
      
      // Try to extract JSON from the response if it contains extra text
      let jsonContent = content.trim();
      
      // Look for JSON object boundaries
      const jsonStart = jsonContent.indexOf('{');
      const jsonEnd = jsonContent.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd);
        console.log('🔍 Extracted JSON content:', jsonContent);
      }
      
      const parts = JSON.parse(jsonContent);
      
      // Validate coordinates
      for (const [partName, part] of Object.entries(parts) as [string, any][]) {
        if (!part.polygon || !Array.isArray(part.polygon)) {
          throw new Error(`Invalid polygon for part: ${partName}`);
        }
        
        for (const coord of part.polygon) {
          if (typeof coord.x !== 'number' || typeof coord.y !== 'number' ||
              coord.x < 0 || coord.x > 1 || coord.y < 0 || coord.y > 1) {
            throw new Error(`Invalid coordinates for part: ${partName}`);
          }
        }
      }
      
      return parts;
      
    } catch (error) {
      console.error('Failed to parse coordinates:', error);
      console.error('Raw content that failed to parse:', content);
      throw new Error('Invalid coordinates JSON from DeepSeek');
    }
  }

  /**
   * Generate parts from technical specification
   */
  async generatePartsFromTechnicalSpec(
    technicalSpec: any
  ): Promise<Record<string, OverlayPart>> {
    const parts: Record<string, OverlayPart> = {};
    
    // Extract parts from layout specifications
    if (technicalSpec.layout_specifications) {
      for (const [partName, spec] of Object.entries(technicalSpec.layout_specifications)) {
        const specObj = spec as any;
        // Generate normalized coordinates based on position description
        const coordinates = this.generateCoordinatesFromPosition(specObj.position, specObj.size);
        
        parts[partName] = {
          polygon: coordinates,
          glow_color: specObj.color || '#00FFFF',
          part_type: partName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          accessibility: 'easy' as const
        };
      }
    }
    
    return parts;
  }

  /**
   * Generate normalized coordinates from position description
   */
  private generateCoordinatesFromPosition(position: string, size: string): any[] {
    const coords: any[] = [];
    
    // Default coordinates based on common positions
    const positions: Record<string, {x: number, y: number}> = {
      'top-left': { x: 0.2, y: 0.2 },
      'top-center': { x: 0.5, y: 0.2 },
      'top-right': { x: 0.8, y: 0.2 },
      'center-left': { x: 0.2, y: 0.5 },
      'center': { x: 0.5, y: 0.5 },
      'center-right': { x: 0.8, y: 0.5 },
      'bottom-left': { x: 0.2, y: 0.8 },
      'bottom-center': { x: 0.5, y: 0.8 },
      'bottom-right': { x: 0.8, y: 0.8 }
    };
    
    const basePos = positions[position?.toLowerCase()] || positions['center'];
    
    // Generate rectangle based on size
    const sizeMultiplier = size === 'large' ? 0.15 : size === 'medium' ? 0.1 : 0.05;
    
    coords.push(
      { x: basePos.x - sizeMultiplier, y: basePos.y - sizeMultiplier },
      { x: basePos.x + sizeMultiplier, y: basePos.y - sizeMultiplier },
      { x: basePos.x + sizeMultiplier, y: basePos.y + sizeMultiplier },
      { x: basePos.x - sizeMultiplier, y: basePos.y + sizeMultiplier }
    );
    
    return coords;
  }

  /**
   * Extract a concise side hint from a free-text location string.
   * Returns values like "driver side", "passenger side", "front left", "rear right", or "center".
   */
  private extractSideHintFromText(text: string): string | null {
    const t = (text || '').toLowerCase();
    // Front/Rear
    const front = /\bfront\b/.test(t);
    const rear = /\brear|back\b/.test(t);
    // Left/Right synonyms
    const left = /\bleft\b/.test(t);
    const right = /\bright\b/.test(t);
    const driver = /driver/.test(t);
    const passenger = /passenger/.test(t);

    if (driver && front) return 'front driver side';
    if (driver && rear) return 'rear driver side';
    if (passenger && front) return 'front passenger side';
    if (passenger && rear) return 'rear passenger side';
    if (driver) return 'driver side';
    if (passenger) return 'passenger side';
    if (front && left) return 'front left';
    if (front && right) return 'front right';
    if (rear && left) return 'rear left';
    if (rear && right) return 'rear right';
    if (left) return 'left';
    if (right) return 'right';
    if (front) return 'front';
    if (rear) return 'rear';
    return null;
  }

  /**
   * Build short variant notes from the technical spec and VIN-derived data.
   */
  private buildVariantNotes(technicalSpec: any, vehicleInfo: any): string {
    const notes: string[] = [];
    if (vehicleInfo?.engine) notes.push(`engine: ${vehicleInfo.engine}`);
    if (vehicleInfo?.trim) notes.push(`trim: ${vehicleInfo.trim}`);
    if (vehicleInfo?.drivetrain) notes.push(`drivetrain: ${vehicleInfo.drivetrain}`);
    if (vehicleInfo?.market) notes.push(`market: ${vehicleInfo.market}`);
    if (vehicleInfo?.steering) notes.push(`steering: ${vehicleInfo.steering}`);

    const v = technicalSpec?.vehicle_specific_details;
    if (v?.part_accessibility) notes.push(`access: ${v.part_accessibility}`);
    if (v?.surrounding_obstacles) notes.push(`obstacles: ${v.surrounding_obstacles}`);
    if (v?.best_viewing_angle) notes.push(`view: ${v.best_viewing_angle}`);

    return notes.join('; ');
  }
}

/**
 * VehicleInfo type for DALL-E prompt generation
 */
type VehicleInfo = {
  year: string | number;
  make: string;
  model: string;
  engine?: string;
  vin?: string;
  bodyStyle?: string;
  trim?: string;
  drivetrain?: string;
  steering?: string;
  market?: string;
};

/**
 * Build a DALL·E-3 prompt for AR ghost-overlay repair guidance.
 * Produces a SHORT, STRICT prompt to reduce model drift.
 */
function buildDallePrompt(
  vehicle: VehicleInfo,
  repairType: string,         // e.g., "battery replacement", "brake service"
  workspaceType: string,      // e.g., "engine bay", "wheel hub assembly", "trunk", "cabin fuse box"
  partName: string,           // e.g., "battery", "brake rotor", "cabin air filter"
  sideHint: string,           // required: "driver side", "passenger side", "front left", "rear right", etc.
  exactPartLocation: string,  // required: precise location string from technical plan
  knownVariantNotes: string   // required: disambiguation notes (engine/trim/market differences)
): string {
  const vehicleDetails = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const engineInfo = vehicle.engine ? ` (${vehicle.engine})` : "";
  const body = vehicle.bodyStyle ? `, ${vehicle.bodyStyle}` : "";
  const trim = vehicle.trim ? `, ${vehicle.trim} trim` : "";
  const drive = vehicle.drivetrain ? `, ${vehicle.drivetrain}` : "";
  const region = vehicle.market ? ` [market: ${vehicle.market}]` : "";
  const steer = vehicle.steering ? ` [steering: ${vehicle.steering}]` : "";

  // Camera/view phrasing tuned per workspace to reduce angle drift
  const viewByWorkspace: Record<string, string> = {
    "engine bay": "front-facing view from a person standing at the bumper, looking straight into the bay",
    "wheel hub assembly": "orthographic front view of the exposed wheel hub/brake assembly at standing height",
    "trunk": "orthographic front view from directly behind the vehicle looking straight into the open trunk",
    "cabin fuse box": "orthographic front view at arm's length, looking straight onto the fuse panel",
  };

  const view = viewByWorkspace[workspaceType.toLowerCase()] ||
               "orthographic front view looking straight at the workspace";

  const side = ` Location: ${sideHint}.`;
  const loc = ` Exact location in this vehicle: ${exactPartLocation}.`;
  const variants = ` Variant notes: ${knownVariantNotes}.`;

  // Keep wording short + imperative; add hard negatives
  return [
    // Goal
    `Transparent PNG AR ghost-overlay for step-by-step ${repairType}.`,
    // Subject
    `Show ONLY the ${workspaceType} of a ${vehicleDetails}${engineInfo}${body}${trim}${drive}${region}${steer}.`,
    `Highlight the ${partName}.${side}${loc}${variants}`,
    // View/crop
    `Crop tightly to the ${workspaceType}; ${view}.`,
    `Do NOT show exterior body, hood skin, bumper, doors, roof, wheels, tires, windows, logos, floor, studio.`,
    // Style
    `Flat technical overlay style:`,
    `- All surrounding components: cyan wireframe`,
    `- Strokes: white, ~4px`,
    `- Active part (${partName}): bright cyan fill with precise outline + strong yellow (#FFFF00) glow`,
    `- No photorealism, no textures, no gradients, no shadows`,
    // Background
    `Background must be fully transparent (alpha).`,
    // Framing/perspective
    `Fixed orthographic perspective optimized for 16:9 overlay; tight framing on the ${workspaceType}.`,
    // Safety rails against drift
    `Left/Right is relative to the VEHICLE (not viewer).`,
    `Avoid angled, top-down, or side views. Avoid full-vehicle renders. Return ONLY the overlay graphics.`,
  ].join("\n");
}

/**
 * Generate access paths using DeepSeek
 */
export async function generateAccessPaths(
  vehicleFamily: string,
  workspaceType: string,
  parts: Record<string, OverlayPart>
): Promise<Record<string, AccessPath>> {
  
  const difficultParts = Object.entries(parts)
    .filter(([_, part]) => part.accessibility === 'difficult')
    .map(([name, _]) => name);
  
  if (difficultParts.length === 0) {
    return {};
  }
  
  const prompt = `Generate access paths for difficult-to-reach automotive parts.

Vehicle Family: ${vehicleFamily}
Workspace Type: ${workspaceType}
Difficult Parts: ${difficultParts.join(', ')}

For each difficult part, create an animated path showing how to access it.
Use normalized coordinates (0.000 to 1.000) for a 1000x600 workspace.

Return ONLY a JSON object:
{
  "part_name": {
    "polyline": [
      {"x": 0.100, "y": 0.200},
      {"x": 0.300, "y": 0.400},
      {"x": 0.500, "y": 0.600}
    ],
    "animation_duration": 3000,
    "stroke_width": 3,
    "dash_pattern": "15,10"
  }
}

Create realistic access paths that show:
- Entry point to the workspace
- Path around obstacles
- Final approach to the part
- 2-4 waypoints per path`;

  try {
    const client = getDeepSeekClient();
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    if (!content) {
      return {};
    }

    try {
      console.log('🔍 Raw DeepSeek response content:', content);
      
      // Try to extract JSON from the response if it contains extra text
      let jsonContent = content.trim();
      
      // Look for JSON object boundaries
      const jsonStart = jsonContent.indexOf('{');
      const jsonEnd = jsonContent.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd);
        console.log('🔍 Extracted JSON content:', jsonContent);
      }
      
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse access paths:', error);
      console.error('Raw content that failed to parse:', content);
      throw new Error('Invalid access paths JSON from DeepSeek');
    }
    
  } catch (error) {
    console.warn('Failed to generate access paths:', error);
    return {};
  }
}

/**
 * Generate cutaway layers using DeepSeek
 */
export async function generateCutawayLayers(
  vehicleFamily: string,
  workspaceType: string
): Promise<Record<string, OverlayLayer>> {
  
  const prompt = `Generate cutaway layers for hidden automotive components.

Vehicle Family: ${vehicleFamily}
Workspace Type: ${workspaceType}

Create semi-transparent layers that can be shown/hidden to reveal parts behind covers.
Use normalized coordinates (0.000 to 1.000) for a 1000x600 workspace.

Return ONLY a JSON object:
{
  "layer_name": {
    "polygon": [
      {"x": 0.123, "y": 0.456},
      {"x": 0.234, "y": 0.567},
      {"x": 0.345, "y": 0.678}
    ],
    "color_tint": "#333333",
    "opacity_cutaway": 0.3,
    "layer_name": "Engine Cover"
  }
}

Include common obstructing components:
- Engine covers/shrouds
- Air intake assemblies  
- Battery covers
- Protective panels

Use appropriate colors and 0.2-0.4 opacity for cutaway mode.`;

  try {
    const client = getDeepSeekClient();
    const response = await fetch(`${client.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    if (!content) {
      return {};
    }

    try {
      console.log('🔍 Raw DeepSeek response content:', content);
      
      // Try to extract JSON from the response if it contains extra text
      let jsonContent = content.trim();
      
      // Look for JSON object boundaries
      const jsonStart = jsonContent.indexOf('{');
      const jsonEnd = jsonContent.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd);
        console.log('🔍 Extracted JSON content:', jsonContent);
      }
      
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse cutaway layers:', error);
      console.error('Raw content that failed to parse:', content);
      throw new Error('Invalid cutaway layers JSON from DeepSeek');
    }
    
  } catch (error) {
    console.warn('Failed to generate cutaway layers:', error);
    return {};
  }
}
