/**
 * Overlay Generation Service
 * Uses DeepSeek to generate SVG workspace diagrams and precise part coordinates
 */

import { classifyVehicleFamily } from './vehicleClassificationService';
import { rateLimitedChatCompletion } from './rateLimitService';
import { OverlayPack, OverlayPart, AccessPath, OverlayLayer, PrecisionCoordinate } from '@/types';
import { DeepSeekDalleOverlayService, generateAccessPaths, generateCutawayLayers } from './hybridOverlayService';
import { supabase } from '@/lib/supabase';

let deepseekClient: any = null;

// Generation locks to prevent duplicate overlay generation
const generationLocks = new Map<string, Promise<OverlayPack>>();

// Supabase configuration check
function isSupabaseConfigured(): boolean {
  return !!supabase;
}

function getDeepSeekClient(): any {
  if (!deepseekClient) {
    const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_DEEPSEEK_API_KEY environment variable is not set');
    }
    // DeepSeek uses OpenAI-compatible API, so we can use fetch directly
    deepseekClient = {
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    };
  }
  return deepseekClient;
}

/**
 * Retry utility function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.message?.includes('Rate limit');
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Rate limit hit, retrying in ${delay/1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

async function getOrGenerateOverlayPack(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string,
  vehicleInfo?: { year?: number; make?: string; model?: string; engine?: string }
): Promise<OverlayPack> {
  
  const cacheKey = `${vehicleFamily}_${workspaceType}`;
  console.log('🔄 getOrGenerateOverlayPack called:', {
    vehicleFamily,
    workspaceType,
    repairType,
    cacheKey,
    vehicleInfo
  });
  
  try {
    // Check if generation is already in progress for this cache key
    if (generationLocks.has(cacheKey)) {
      console.log('🔒 Generation already in progress, waiting for completion:', cacheKey);
      return await generationLocks.get(cacheKey)!;
    }
    
    // Check cache first
    console.log('🔍 Checking Supabase cache for overlay pack...');
    
    // Validate Supabase configuration before cache check
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, skipping cache check');
      throw new Error('Supabase not configured - cannot check overlay pack cache');
    }
    
    const { data: cached, error } = await supabase
      .from('overlay_packs')
      .select('*')
      .eq('id', cacheKey)
      .single();
    
    if (error) {
      console.log('📊 Cache lookup error (normal for new overlays):', {
        code: error.code,
        message: error.message,
        cacheKey
      });
    } else {
      console.log('📊 Cache lookup result:', {
        found: !!cached,
        cacheKey,
        cached_id: cached?.id || null,
        usage_count: cached?.usage_count || 0
      });
    }
    
    if (cached && !error) {
      console.log('✅ CACHE HIT - Using existing overlay pack (DALL-E 3 NOT called):', {
        id: cached.id,
        usage_count: cached.usage_count,
        parts_count: Object.keys(cached.parts).length
      });
      
      // Update usage count
      console.log('📈 Updating usage count for cached overlay pack...');
      await supabase
        .from('overlay_packs')
        .update({ usage_count: cached.usage_count + 1 })
        .eq('id', cacheKey);
      
      return cached;
    }
    
    console.log('❌ CACHE MISS - Will generate new overlay pack (DALL-E 3 will be called)');
    
    // Create generation promise and store in lock
    const generationPromise = (async (): Promise<OverlayPack> => {
      try {
        // Double-check cache in case another request created it while we were waiting
        const { data: doubleCheck } = await supabase
          .from('overlay_packs')
          .select('*')
          .eq('id', cacheKey)
          .single();
        
        if (doubleCheck) {
          console.log('✅ CACHE HIT on double-check - Another request created it:', doubleCheck.id);
          return doubleCheck;
        }
        
        // Generate new overlay pack with vehicle-specific information
        console.log('🎨 Starting overlay pack generation process...');
        console.log('📊 Generation parameters:', {
          vehicleFamily,
          workspaceType,
          repairType,
          vehicleInfo,
          hasOpenAIKey: !!process.env.EXPO_PUBLIC_OPENAI_API_KEY,
          hasDeepSeekKey: !!process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY
        });
        
        const overlayPack = await generateOverlayPack(vehicleFamily, workspaceType, repairType, vehicleInfo);
        
        if (!overlayPack) {
          throw new Error('Overlay pack generation returned null/undefined');
        }
        
        console.log('📦 Overlay pack generation completed successfully:', {
          id: overlayPack.id,
          vehicle_family: overlayPack.vehicle_family,
          workspace_type: overlayPack.workspace_type,
          workspace_svg_present: !!overlayPack.workspace_svg,
          workspace_svg_length: overlayPack.workspace_svg?.length || 0,
          image_url_present: !!overlayPack.image_url,
          image_url_length: overlayPack.image_url?.length || 0,
          parts_count: Object.keys(overlayPack.parts).length,
          has_access_paths: !!overlayPack.access_paths,
          has_layers: !!overlayPack.layers,
          gpt_model: overlayPack.gpt_model
        });
        
        // Cache for future use
        const { error: upsertError } = await supabase
          .from('overlay_packs')
          .upsert(overlayPack, {
            onConflict: 'vehicle_family,workspace_type'
          });
        
        console.log('💾 Cache upsert result:', {
          success: !upsertError,
          error_message: upsertError?.message || null,
          error_details: upsertError?.details || null,
          error_hint: upsertError?.hint || null,
          error_code: upsertError?.code || null
        });
        
        if (upsertError) {
          console.error('❌ Failed to cache overlay pack (continuing anyway):', {
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            code: upsertError.code,
            overlay_pack_id: overlayPack.id
          });
        } else {
          console.log('✅ Overlay pack cached successfully for:', overlayPack.id);
        }
        
        console.log('🚀 Returning generated overlay pack to loading screen');
        
        return overlayPack;
      } finally {
        // Clean up lock when done
        generationLocks.delete(cacheKey);
      }
    })();
    
    // Store the promise in the lock
    generationLocks.set(cacheKey, generationPromise);
    
    return await generationPromise;
    
  } catch (error) {
    // Clean up lock on error
    generationLocks.delete(cacheKey);
    console.error('❌ getOrGenerateOverlayPack failed:', {
      cacheKey,
      vehicleFamily,
      workspaceType,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to get overlay pack: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a complete overlay pack using DeepSeek + DALL-E 3 system
 */
export async function generateOverlayPack(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string,
  vehicleInfo?: { year?: number; make?: string; model?: string; engine?: string }
): Promise<OverlayPack> {
  
  console.log(`🎨 Generating hybrid overlay pack: ${vehicleFamily} - ${workspaceType}`);
  
  // Try hybrid DeepSeek + DALL-E 3 system first, fallback to DeepSeek only
  try {
    return await generateOverlayPackHybrid(vehicleFamily, workspaceType, repairType, vehicleInfo);
  } catch (hybridError) {
    console.warn('⚠️ Hybrid DeepSeek + DALL-E 3 generation failed, falling back to DeepSeek only:', hybridError);
    return await generateOverlayPackDeepSeekOnly(vehicleFamily, workspaceType, repairType);
  }
}

/**
 * DeepSeek + DALL-E 3 generation
 */
async function generateOverlayPackHybrid(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string,
  vehicleInfo?: { year?: number; make?: string; model?: string; engine?: string }
): Promise<OverlayPack> {
  
  console.log(`🚀 Using DeepSeek + DALL-E 3 overlay generation system`);
  console.log('🔄 Using classified vehicle family for consistent caching:', vehicleFamily);
  
  const hybridService = new DeepSeekDalleOverlayService();
  
  try {
    // Phase 1: DeepSeek technical planning
    console.log('🔄 Phase 1/4: DeepSeek technical planning...');
    const technicalSpec = await retryWithBackoff(() => 
      hybridService.deepseekTechnicalPlanning(vehicleFamily, workspaceType, repairType, vehicleInfo)
    );
    console.log('✅ Phase 1/4: Technical specification generated');
    
    // Phase 2: DALL-E 3 visual generation with vehicle-specific context
    console.log('🔄 Phase 2/4: DALL-E 3 transparent PNG generation with vehicle context...');
    const imageUrl = await retryWithBackoff(() => 
      hybridService.dalleVisualGeneration(
        vehicleInfo || {}, 
        repairType, 
        workspaceType,
        technicalSpec.visual_brief.target_part
      )
    );
    console.log('✅ Phase 2/4: Vehicle-specific transparent PNG overlay generated from DALL-E 3');
    
    // Phase 3: Generate coordinates from technical specification (not from image)
    console.log('🔄 Phase 3/4: Generating part coordinates from technical specification...');
    const parts = await retryWithBackoff(() => 
      hybridService.generatePartsFromTechnicalSpec(technicalSpec)
    );
    console.log(`✅ Phase 3/4: Generated ${Object.keys(parts).length} part coordinates`);
    
    // Phase 4: Generate access paths and layers
    console.log('🔄 Phase 4/4: Generating access paths and layers...');
    const [accessPaths, layers] = await Promise.all([
      retryWithBackoff(() => generateAccessPaths(vehicleFamily, workspaceType, parts)),
      retryWithBackoff(() => generateCutawayLayers(vehicleFamily, workspaceType))
    ]);
    console.log(`✅ Phase 4/4: Generated ${Object.keys(accessPaths).length} access paths, ${Object.keys(layers).length} layers`);
    
    console.log('🔄 Constructing overlay pack object...');
    
    try {
      // Validate required data before constructing overlay pack
      if (!imageUrl || imageUrl.trim().length === 0) {
        throw new Error('imageUrl is empty or invalid');
      }
      
      if (!parts || Object.keys(parts).length === 0) {
        console.warn('⚠️ No parts generated, but continuing with empty parts object');
      }
      
      console.log('📊 Pre-construction validation:', {
        imageUrl_length: imageUrl.length,
        parts_count: Object.keys(parts).length,
        access_paths_count: Object.keys(accessPaths).length,
        layers_count: Object.keys(layers).length,
        vehicleFamily,
        workspaceType
      });
    
      // Use consistent vehicle family for cache key matching
      const overlayPack: OverlayPack = {
        id: `${vehicleFamily}_${workspaceType}`,
        vehicle_family: vehicleFamily,
        workspace_type: workspaceType,
        image_url: imageUrl,
        baseline_dimensions: { width: 1000, height: 600 },
        parts,
        access_paths: Object.keys(accessPaths).length > 0 ? accessPaths : undefined,
        layers: Object.keys(layers).length > 0 ? layers : undefined,
        generated_at: new Date().toISOString(),
        gpt_model: 'hybrid-deepseek-dalle3',
        usage_count: 0
      };
      
      console.log('✅ Overlay pack constructed successfully:', {
        id: overlayPack.id,
        vehicle_family: overlayPack.vehicle_family,
        workspace_type: overlayPack.workspace_type,
        has_image_url: !!overlayPack.image_url,
        cache_key_matches: overlayPack.id === `${vehicleFamily}_${workspaceType}`
      });
      
      return overlayPack;

    } catch (constructionError) {
      console.error('❌ Failed to construct overlay pack:', constructionError);
      throw new Error(`Overlay pack construction failed: ${constructionError instanceof Error ? constructionError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Hybrid overlay generation failed:', error);
    throw error;
  }
}

/**
 * Fallback DeepSeek only generation (original system)
 */
async function generateOverlayPackDeepSeekOnly(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string
): Promise<OverlayPack> {
  
  console.log(`🔄 Using fallback DeepSeek only system`);
  
  try {
    // Generate SVG workspace diagram
    console.log('🔄 Step 1/4: Generating workspace SVG...');
    const workspaceSvg = await retryWithBackoff(() => generateWorkspaceSVG(vehicleFamily, workspaceType));
    console.log('✅ Step 1/4: Workspace SVG generated');
    
    // Generate part definitions with coordinates
    console.log('🔄 Step 2/4: Generating part definitions...');
    const parts = await retryWithBackoff(() => generatePartDefinitions(vehicleFamily, workspaceType, repairType));
    console.log(`✅ Step 2/4: Generated ${Object.keys(parts).length} part definitions`);
    
    // Generate access paths for difficult parts
    console.log('🔄 Step 3/4: Generating access paths...');
    const accessPaths = await retryWithBackoff(() => generateAccessPaths(vehicleFamily, workspaceType, parts));
    console.log(`✅ Step 3/4: Generated ${Object.keys(accessPaths).length} access paths`);
    
    // Generate cutaway layers for hidden parts
    console.log('🔄 Step 4/4: Generating cutaway layers...');
    const layers = await retryWithBackoff(() => generateCutawayLayers(vehicleFamily, workspaceType));
    console.log(`✅ Step 4/4: Generated ${Object.keys(layers).length} cutaway layers`);
    
    const overlayPack: OverlayPack = {
      id: `${vehicleFamily}_${workspaceType}`,
      vehicle_family: vehicleFamily,
      workspace_type: workspaceType,
      workspace_svg: workspaceSvg,
      image_url: '', // Fallback overlay pack has no image URL
      baseline_dimensions: { width: 1000, height: 600 },
      parts,
      access_paths: Object.keys(accessPaths).length > 0 ? accessPaths : undefined,
      layers: Object.keys(layers).length > 0 ? layers : undefined,
      generated_at: new Date().toISOString(),
      gpt_model: 'deepseek',
      usage_count: 0
    };
    
    console.log(`✅ Generated fallback overlay pack with ${Object.keys(parts).length} parts`);
    console.log(`📊 Overlay pack structure:`, {
      id: overlayPack.id,
      parts_count: Object.keys(overlayPack.parts).length,
      access_paths_count: overlayPack.access_paths ? Object.keys(overlayPack.access_paths).length : 0,
      layers_count: overlayPack.layers ? Object.keys(overlayPack.layers).length : 0,
      has_access_paths: !!overlayPack.access_paths,
      has_layers: !!overlayPack.layers
    });
    
    return overlayPack;
    
  } catch (error) {
    console.error('❌ Fallback overlay generation failed:', error);
    throw new Error(`Failed to generate overlay pack: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates SVG workspace diagram using DeepSeek
 */
async function generateWorkspaceSVG(vehicleFamily: string, workspaceType: string): Promise<string> {
  
  const prompt = `Generate a technical automotive workspace SVG showing ${workspaceType} view for ${vehicleFamily} vehicles.

Requirements:
- Use HIGH CONTRAST COLORS optimized for AR camera overlay:
  * Bright cyan (#00FFFF) for main structural elements and fills
  * White (#FFFFFF) for strokes and outlines (4px width minimum)  
  * Yellow (#FFFF00) for secondary components and highlights
  * NO gray colors (#ccc, #333, etc.) - they are invisible over camera
- SVG viewBox="0 0 1000 600" with clean technical wireframe style
- Include major automotive components: engine block, battery, air filter, brake components
- Use <rect>, <circle>, <path> elements with proper fill and stroke attributes
- Add glow effects with filters for better visibility over camera background
- Semi-transparent fills (opacity 0.7) with solid bright strokes

Generate clean, valid SVG markup optimized for mobile AR display over live camera feed.`;

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
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const rawContent = result.choices[0].message.content;
  
  console.log('🔍 DeepSeek SVG Response (first 300 chars):', rawContent?.substring(0, 300));
  console.log('🔍 Response length:', rawContent?.length);
  console.log('🔍 Contains <svg>:', rawContent?.includes('<svg'));
  console.log('🔍 Contains </svg>:', rawContent?.includes('</svg>'));
  
  if (!rawContent) {
    throw new Error('No SVG content returned from DeepSeek');
  }
  
  // Extract SVG content from response (in case there's explanatory text)
  const svgStart = rawContent.indexOf('<svg');
  const svgEnd = rawContent.lastIndexOf('</svg>') + 6;
  
  if (svgStart === -1 || svgEnd === 5) {
    console.log('🔍 Full DeepSeek response:', rawContent);
    throw new Error('DeepSeek response does not contain valid SVG markup');
  }
  
  const svgContent = rawContent.substring(svgStart, svgEnd);
  console.log('🔍 Extracted SVG length:', svgContent.length);
  console.log('🔍 SVG starts with:', svgContent.substring(0, 50));

  return svgContent.trim();
}

/**
 * Generates part definitions with precise coordinates
 */
async function generatePartDefinitions(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string
): Promise<Record<string, OverlayPart>> {
  
  const prompt = `You are a JSON generator for automotive repair overlays. Generate ONLY JSON with no explanations.

Vehicle Family: ${vehicleFamily}
Workspace Type: ${workspaceType}
Repair Type: ${repairType}

For a 1000x600 workspace, define parts with normalized coordinates (0.000 to 1.000).

Return ONLY a flat JSON object where each key is a part name and each value contains polygon, glow_color, part_type, and accessibility:

{
  "air_filter": {
    "polygon": [
      {"x": 0.350, "y": 0.200},
      {"x": 0.550, "y": 0.200},
      {"x": 0.550, "y": 0.350},
      {"x": 0.350, "y": 0.350}
    ],
    "glow_color": "#00FFFF",
    "part_type": "filter",
    "accessibility": "easy"
  },
  "battery": {
    "polygon": [
      {"x": 0.100, "y": 0.100},
      {"x": 0.250, "y": 0.100},
      {"x": 0.250, "y": 0.200},
      {"x": 0.100, "y": 0.200}
    ],
    "glow_color": "#FF6B35",
    "part_type": "electrical",
    "accessibility": "moderate"
  }
}

Include relevant parts for ${repairType}:
- Primary target part (air filter, battery, oil filter, etc.)
- Related components that might need access
- Safety-critical nearby parts

Use precise 3-decimal coordinates. Make polygons realistic part shapes.
Use appropriate glow colors: #00FFFF (cyan), #00FF00 (green), #FF6B35 (orange), #FF0080 (pink).

DO NOT include metadata like "vehicle_family", "workspace_type", or "parts" array. Return ONLY the flat object with part names as keys.`;

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
  const rawContent = result.choices[0].message.content;
  
  console.log('🔍 DeepSeek Parts Response (first 200 chars):', rawContent?.substring(0, 200));
  
  if (!rawContent) {
    throw new Error('No parts response from DeepSeek');
  }

  // Extract JSON content from response (in case there's explanatory text)
  let jsonContent = rawContent.trim();
  
  // Try to find JSON object boundaries
  const jsonStart = rawContent.indexOf('{');
  const jsonEnd = rawContent.lastIndexOf('}') + 1;
  
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    jsonContent = rawContent.substring(jsonStart, jsonEnd);
    console.log('🔍 Extracted JSON length:', jsonContent.length);
  }

  try {
    const parts = JSON.parse(jsonContent);
    
    // Validate each part
    for (const [partName, part] of Object.entries(parts) as [string, any][]) {
      if (!part.polygon || !Array.isArray(part.polygon)) {
        throw new Error(`Invalid polygon for part: ${partName}`);
      }
      
      // Validate coordinates
      for (const coord of part.polygon) {
        if (typeof coord.x !== 'number' || typeof coord.y !== 'number' ||
            coord.x < 0 || coord.x > 1 || coord.y < 0 || coord.y > 1) {
          throw new Error(`Invalid coordinates for part: ${partName}`);
        }
      }
    }
    
    return parts;
    
  } catch (error) {
    console.error('Failed to parse parts JSON:', error);
    throw new Error('Invalid parts JSON from DeepSeek');
  }
}

// Access paths and cutaway layers moved to hybridOverlayService.ts
// These functions are now imported and used by both hybrid and fallback systems