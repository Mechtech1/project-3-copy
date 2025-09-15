import { RepairTask, RepairStep, Tool, OverlayPack } from '@/types';
import { supabase, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase';
import axios from 'axios';

// Add overlay system imports
import { getCachedVehicleClassification, determineWorkspaceForRepair } from './vehicleClassificationService';
import { generateOverlayPack } from './overlayGenerationService';

export interface GPTRepairStep {
  step_number: number;
  instruction: string;
  tool: string;
  part_name?: string;
}

export interface GenerateRepairRequest {
  vin: string;
  repair_type: string;
}

const REPAIR_TYPE_MAPPING: Record<string, string> = {
  oil_change: 'Oil Change',
  brake_inspection: 'Brake Inspection',
  tire_rotation: 'Tire Rotation',
  battery_check: 'Battery Check',
  air_filter_replacement: 'Air Filter Replacement',
  coolant_flush: 'Coolant Flush',
};

export async function getRepairTasksForVehicle(make: string, model: string, year: number): Promise<RepairTask[]> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return [];
  }

  try {
    // Fetch repair tasks compatible with the vehicle
    const { data: tasks, error: tasksError } = await supabase
      .from('repair_tasks')
      .select('*')
      .eq('vehicle_make', make)
      .or(`vehicle_model.is.null,vehicle_model.eq.${model}`)
      .or(`vehicle_year_min.is.null,vehicle_year_min.lte.${year}`)
      .or(`vehicle_year_max.is.null,vehicle_year_max.gte.${year}`);

    if (tasksError) {
      console.error('Error fetching repair tasks:', tasksError);
      return [];
    }

    if (!tasks || tasks.length === 0) {
      return [];
    }

    // Fetch tools and steps for each task
    const repairTasks: RepairTask[] = [];
    
    for (const task of tasks) {
      // Fetch tools for this task
      const { data: tools, error: toolsError } = await supabase
        .from('repair_tools')
        .select('*')
        .eq('repair_task_id', task.id);

      if (toolsError) {
        console.error('Error fetching tools:', toolsError);
        continue;
      }

      // Fetch steps for this task
      const { data: steps, error: stepsError } = await supabase
        .from('repair_steps')
        .select('*')
        .eq('repair_task_id', task.id)
        .order('step_number');

      if (stepsError) {
        console.error('Error fetching steps:', stepsError);
        continue;
      }

      // Transform database data to app types
      const toolsRequired: Tool[] = (tools || []).map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        required: tool.required,
      }));

      const repairSteps: RepairStep[] = (steps || []).map(step => ({
        id: step.id,
        stepNumber: step.step_number,
        instruction: step.instruction,
        toolRequired: step.tool_required || undefined,
        partName: step.part_name || 'Unknown Part',
          audioScript: step.audio_script,
      }));

      repairTasks.push({
        id: task.id,
        name: task.name,
        description: task.description,
        estimatedTime: task.estimated_time,
        difficulty: task.difficulty,
        toolsRequired,
        steps: repairSteps,
      });
    }

    return repairTasks;
  } catch (error) {
    console.error('Error in getRepairTasksForVehicle:', error);
    return [];
  }
}

export async function getRepairTaskById(id: string): Promise<RepairTask | null> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return null;
  }

  try {
    // Check if this is an AI-generated task (ID starts with 'gpt-')
    if (id.startsWith('gpt-')) {
      // Parse the AI-generated task ID: gpt-{repair_type}-{vin}
      const parts = id.split('-');
      if (parts.length >= 3) {
        const repairType = parts[1];
        const vin = parts.slice(2).join('-'); // VIN might contain dashes
        
        // Try to get from cache first
        const { data: cachedData, error: cacheError } = await supabase
          .from('gpt_repair_cache')
          .select('gpt_response, make, model, year')
          .eq('vin', vin)
          .eq('repair_type', repairType)
          .limit(1);

        if (cachedData && cachedData.length > 0 && !cacheError) {
          const cached = cachedData[0];
          // Reconstruct RepairTask from cached data
          const gptSteps: GPTRepairStep[] = cached.gpt_response;
          
          const repairSteps: RepairStep[] = gptSteps.map((step, index) => ({
            id: `gpt-step-${index + 1}`,
            stepNumber: index + 1,
            instruction: step.instruction,
            toolRequired: step.tool,
            partName: step.part_name || 'Unknown Part',
            audioScript: step.instruction,
          }));

          const uniqueTools = new Set(gptSteps.map(step => step.tool));
          const toolsRequired: Tool[] = Array.from(uniqueTools).map((toolName, index) => ({
            id: `gpt-tool-${index + 1}`,
            name: toolName,
            description: `Required for ${REPAIR_TYPE_MAPPING[repairType as keyof typeof REPAIR_TYPE_MAPPING]}`,
            required: true,
            checked: false,
          }));

          const estimatedTime = `${Math.max(30, gptSteps.length * 10)} minutes`;

          return {
            id,
            name: REPAIR_TYPE_MAPPING[repairType as keyof typeof REPAIR_TYPE_MAPPING],
            description: `AI-generated instructions for ${REPAIR_TYPE_MAPPING[repairType as keyof typeof REPAIR_TYPE_MAPPING]} on ${cached.year} ${cached.make} ${cached.model}`,
            estimatedTime,
            difficulty: getDifficultyForRepairType(repairType as any),
            toolsRequired,
            steps: repairSteps,
          };
        } else {
          // Cache miss - regenerate the task
          console.log('AI task not found in cache, regenerating:', id);
          const request: GenerateRepairRequest = {
            vin,
            repair_type: repairType as any,
          };
          return await generateRepairSteps(request);
        }
      }
      
      console.error('Invalid AI-generated task ID format:', id);
      return null;
    }

    // Regular database task lookup
    const { data: task, error: taskError } = await supabase
      .from('repair_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      console.error('Error fetching repair task:', taskError);
      return null;
    }

    // Fetch tools for this task
    const { data: tools, error: toolsError } = await supabase
      .from('repair_tools')
      .select('*')
      .eq('repair_task_id', task.id);

    if (toolsError) {
      console.error('Error fetching tools:', toolsError);
      return null;
    }

    // Fetch steps for this task
    const { data: steps, error: stepsError } = await supabase
      .from('repair_steps')
      .select('*')
      .eq('repair_task_id', task.id)
      .order('step_number');

    if (stepsError) {
      console.error('Error fetching steps:', stepsError);
      return null;
    }

    // Transform database data to app types
    const toolsRequired: Tool[] = (tools || []).map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      required: tool.required,
    }));

    const repairSteps: RepairStep[] = (steps || []).map(step => ({
      id: step.id,
      stepNumber: step.step_number,
      instruction: step.instruction,
      toolRequired: step.tool_required || undefined,
      partName: step.part_name || 'Generic Part',
      audioScript: step.audio_script,
    }));

    return {
      id: task.id,
      name: task.name,
      description: task.description,
      estimatedTime: task.estimated_time,
      difficulty: task.difficulty,
      toolsRequired,
      steps: repairSteps,
    };
  } catch (error) {
    console.error('Error in getRepairTaskById:', error);
    return null;
  }
}

/**
 * Generate AI-powered repair instructions using GPT-5 and VIN decoding
 */
export async function generateRepairSteps(request: GenerateRepairRequest): Promise<RepairTask | null> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return null;
  }

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    // Debug logging
    console.log('🔍 Debug Info:');
    console.log('- Supabase URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING');
    console.log('- Supabase Key:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING');
    console.log('- Request:', request);
    
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const fullUrl = `${supabaseUrl}/functions/v1/generateRepairSteps`;
    console.log('📡 Calling URL:', fullUrl);

    // Try multiple fetch approaches for React Native compatibility
    let response: Response;
    
    try {
      // Approach 1: Standard fetch with all headers
      console.log('📡 Trying standard fetch...');
      response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json',
          'User-Agent': 'MechVision-RN-App/1.0',
        },
        body: JSON.stringify({
          vin: request.vin,
          repair_type: request.repair_type
        }),
      });
    } catch (fetchError) {
      console.log('❌ Standard fetch failed, trying axios approach...');
      
      // Approach 2: Axios (more reliable in React Native)
      try {
        console.log('📡 Trying axios...');
        const axiosResponse = await axios.post(fullUrl, {
          vin: request.vin,
          repair_type: request.repair_type
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'Accept': 'application/json',
          },
          timeout: 30000,
        });
        
        // Convert axios response to fetch-like Response
        response = new Response(JSON.stringify(axiosResponse.data), {
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        });
        console.log('✅ Axios succeeded');
      } catch (axiosError) {
        console.log('❌ Axios also failed, trying XMLHttpRequest approach...');
        
        // Approach 3: XMLHttpRequest fallback for React Native
        response = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', fullUrl, true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
          xhr.setRequestHeader('Accept', 'application/json');
          
          xhr.onload = () => {
            const response = new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers(),
            });
            resolve(response);
          };
          
          xhr.onerror = () => reject(new Error('XMLHttpRequest failed'));
          xhr.ontimeout = () => reject(new Error('XMLHttpRequest timeout'));
          
          xhr.timeout = 30000; // 30 second timeout
          xhr.send(JSON.stringify({
            vin: request.vin,
            repair_type: request.repair_type
          }));
        });
      }
    }

    console.log('📡 Response status:', response.status);
    console.log('📡 Response ok:', response.ok);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.log('📡 Error response data:', errorData);
      } catch {
        // If we can't parse error JSON, get text
        try {
          const errorText = await response.text();
          console.log('📡 Error response text:', errorText);
          errorMessage = errorText || errorMessage;
        } catch {
          console.log('📡 Could not parse error response');
        }
      }
      throw new Error(errorMessage);
    }

    const gptSteps: GPTRepairStep[] = await response.json();
    console.log('✅ Received GPT steps:', gptSteps.length, 'steps');
    
    // Transform GPT response to RepairTask format
    const repairSteps: RepairStep[] = gptSteps.map((step, index) => ({
      id: `gpt-step-${index + 1}`,
      stepNumber: index + 1,
      instruction: step.instruction,
      toolRequired: step.tool,
      partName: step.part_name || 'Generic Part',
      audioScript: step.instruction, // Use instruction as audio script
    }));

    // Create tools list from unique tools mentioned in steps
    const uniqueTools = new Set(gptSteps.map(step => step.tool));
    const toolsRequired: Tool[] = Array.from(uniqueTools).map((toolName, index) => ({
      id: `gpt-tool-${index + 1}`,
      name: toolName,
      description: `Required for ${REPAIR_TYPE_MAPPING[request.repair_type]}`,
      required: true,
      checked: false,
    }));

    // Calculate estimated time based on number of steps
    const estimatedTime = `${Math.max(30, gptSteps.length * 10)} minutes`;

    const repairTask: RepairTask = {
      id: `gpt-${request.repair_type}-${request.vin}`,
      name: REPAIR_TYPE_MAPPING[request.repair_type],
      description: `AI-generated instructions for ${REPAIR_TYPE_MAPPING[request.repair_type]} on vehicle ${request.vin}`,
      estimatedTime,
      difficulty: getDifficultyForRepairType(request.repair_type),
      toolsRequired,
      steps: repairSteps,
    };

    console.log('✅ Generated repair task successfully');
    return repairTask;
  } catch (error) {
    console.error('❌ Error generating repair steps:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error name:', (error as Error)?.name);
    console.error('❌ Error message:', (error as Error)?.message);
    
    // If it's a network error, provide a more helpful message
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      console.error('❌ Network error - this might be a simulator/emulator networking issue');
      throw new Error('Network connection failed. Try on a physical device or different network.');
    }
    
    throw error;
  }
}

/**
 * Enhanced repair generation with overlay pack integration
 */
export async function generateRepairStepsWithOverlay(request: GenerateRepairRequest): Promise<{
  repairTask: RepairTask;
  overlayPack: OverlayPack;
}> {
  
  console.log('🔄 Generating repair with overlay integration:', request);
  
  try {
    // Step 1: Generate repair task (existing functionality)
    const repairTask = await generateRepairSteps(request);
    if (!repairTask) {
      throw new Error('Failed to generate repair task');
    }
    
    // Step 2: Decode VIN to get vehicle information
    const vehicleInfo = await decodeVINToVehicleInfo(request.vin);
    
    // Step 3: Classify vehicle into family
    const vehicleClassification = await getCachedVehicleClassification(
      vehicleInfo.year,
      vehicleInfo.make,
      vehicleInfo.model
    );
    
    // Step 4: Determine workspace type for this repair
    const workspaceType = determineWorkspaceForRepair(request.repair_type);
    
    // Step 5: Get or generate overlay pack with vehicle-specific context
    const overlayPack = await getOrGenerateOverlayPack(
      vehicleClassification.family,
      workspaceType,
      request.repair_type,
      vehicleInfo
    );
    
    console.log('✅ Generated repair with overlay pack successfully');
    return { repairTask, overlayPack };
    
  } catch (error) {
    console.error('❌ Failed to generate repair with overlay:', error);
    
    // Fallback: return repair task without overlay
    try {
      const repairTask = await generateRepairSteps(request);
      if (!repairTask) {
        throw new Error('Failed to generate fallback repair task');
      }
      const fallbackOverlay = createFallbackOverlayPack(request.repair_type);
      
      return { repairTask, overlayPack: fallbackOverlay };
    } catch (fallbackError) {
      console.error('❌ Fallback repair generation also failed:', fallbackError);
      throw new Error('Failed to generate repair task and overlay pack');
    }
  }
}

// Add generation lock to prevent concurrent generations
const generationLocks = new Map<string, Promise<OverlayPack>>();

/**
 * Gets overlay pack from cache or generates new one
 */
async function getOrGenerateOverlayPack(
  vehicleFamily: string,
  workspaceType: string,
  repairType: string,
  vehicleInfo?: { year?: number; make?: string; model?: string; engine?: string }
): Promise<OverlayPack> {
  
  const cacheKey = `${vehicleFamily}_${workspaceType}`;
  
  try {
    // Check if generation is already in progress for this cache key
    if (generationLocks.has(cacheKey)) {
      console.log('🔒 Generation already in progress, waiting for completion:', cacheKey);
      return await generationLocks.get(cacheKey)!;
    }
    
    // Check cache first
    console.log('🔍 Checking cache for overlay pack:', {
      cacheKey,
      vehicleFamily,
      workspaceType,
      repairType
    });
    
    const { data: cached, error } = await supabase
      .from('overlay_packs')
      .select('*')
      .eq('vehicle_family', vehicleFamily)
      .eq('workspace_type', workspaceType)
      .limit(1);
    
    console.log('📊 Cache lookup result:', {
      found: !!(cached && cached.length > 0),
      error: error?.message || null,
      cacheKey,
      cached_id: cached && cached.length > 0 ? cached[0].id : null
    });
    
    if (cached && cached.length > 0 && !error) {
      const overlayPack = cached[0];
      console.log('✅ CACHE HIT - Using existing overlay pack (DALL-E 3 NOT called):', {
        id: overlayPack.id,
        vehicle_family: overlayPack.vehicle_family,
        workspace_type: overlayPack.workspace_type
      });
      
      return overlayPack;
    }
    
    console.log('❌ CACHE MISS - Will generate new overlay pack (DALL-E 3 will be called ONCE)');
    
    // Create generation promise and store in lock
    const generationPromise = (async (): Promise<OverlayPack> => {
      try {
        // Double-check cache in case another request created it while we were waiting
        const { data: doubleCheck } = await supabase
          .from('overlay_packs')
          .select('*')
          .eq('vehicle_family', vehicleFamily)
          .eq('workspace_type', workspaceType)
          .limit(1);
        
        if (doubleCheck && doubleCheck.length > 0) {
          console.log('✅ CACHE HIT on double-check - Another request created it:', doubleCheck[0].id);
          return doubleCheck[0];
        }
        
        // Generate new overlay pack with vehicle-specific information
        console.log('🎨 Generating new overlay pack with DALL-E 3 (ONE TIME ONLY):', vehicleInfo);
        const overlayPack = await generateOverlayPack(vehicleFamily, workspaceType, repairType, vehicleInfo);
        
        console.log('📦 Overlay pack generation completed, received from generator:', {
          id: overlayPack.id,
          vehicle_family: overlayPack.vehicle_family,
          workspace_type: overlayPack.workspace_type,
          workspace_svg_present: !!overlayPack.workspace_svg,
          workspace_svg_length: overlayPack.workspace_svg?.length || 0,
          parts_count: Object.keys(overlayPack.parts).length,
          has_access_paths: !!overlayPack.access_paths,
          has_layers: !!overlayPack.layers
        });
        
        // Cache for future use
        console.log('💾 Caching overlay pack to prevent future DALL-E 3 calls:', {
          id: overlayPack.id,
          vehicle_family: overlayPack.vehicle_family,
          workspace_type: overlayPack.workspace_type,
          has_access_paths: !!overlayPack.access_paths,
          has_layers: !!overlayPack.layers
        });
        
        console.log('🔄 Attempting database insertion...');
        
        const { error: upsertError } = await supabase
          .from('overlay_packs')
          .upsert(overlayPack, {
            onConflict: 'vehicle_family,workspace_type'
          });
        
        console.log('📊 Database insertion result:', {
          success: !upsertError,
          error_message: upsertError?.message || null,
          error_details: upsertError?.details || null,
          error_hint: upsertError?.hint || null,
          error_code: upsertError?.code || null,
          overlay_pack_id: overlayPack.id,
          overlay_pack_structure: {
            id: overlayPack.id,
            vehicle_family: overlayPack.vehicle_family,
            workspace_type: overlayPack.workspace_type,
            has_image_url: !!overlayPack.image_url,
            has_parts: !!overlayPack.parts,
            has_layers: !!overlayPack.layers,
            has_baseline_dimensions: !!overlayPack.baseline_dimensions
          }
        });
        
        if (upsertError) {
          console.error('❌ Failed to cache overlay pack (continuing anyway):', {
            message: upsertError.message,
            details: upsertError.details,
            hint: upsertError.hint,
            code: upsertError.code,
            overlay_pack_id: overlayPack.id,
            full_error: JSON.stringify(upsertError, null, 2),
            overlay_pack_data: JSON.stringify(overlayPack, null, 2)
          });
          // Continue anyway, we have the overlay pack
        } else {
          console.log('✅ Successfully cached overlay pack - Future requests will use cache (no DALL-E 3 calls)');
          
          // Verify the cache was written correctly
          console.log('🔍 Verifying database write...');
          const { data: verification } = await supabase
            .from('overlay_packs')
            .select('id, usage_count')
            .eq('id', overlayPack.id)
            .single();
          
          if (verification) {
            console.log('✅ Cache verification successful - DALL-E 3 will not be called again for this overlay:', verification);
          } else {
            console.warn('⚠️ Cache verification failed - overlay pack may not be properly stored, could cause regeneration');
          }
        }
        
        console.log('🚀 Returning overlay pack to UI layer:', {
          id: overlayPack.id,
          workspace_svg_length: overlayPack.workspace_svg?.length || 0,
          parts_count: Object.keys(overlayPack.parts).length
        });
        
        return overlayPack;
      } finally {
        // Always remove the lock when done
        generationLocks.delete(cacheKey);
      }
    })();
    
    // Store the promise in the lock
    generationLocks.set(cacheKey, generationPromise);
    
    return await generationPromise;
    
  } catch (error) {
    // Clean up lock on error
    generationLocks.delete(cacheKey);
    console.error('❌ Overlay pack generation failed:', error);
    throw new Error(`Failed to get overlay pack: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decodes VIN to get vehicle information using free NHTSA API
 */
async function decodeVINToVehicleInfo(vin: string): Promise<{
  year: number;
  make: string;
  model: string;
  trim?: string;
}> {
  
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );
    
    const data = await response.json();
    
    if (data.Results) {
      const results = data.Results;
      
      // Extract vehicle information from NHTSA response
      const year = parseInt(results.find((r: any) => r.Variable === 'Model Year')?.Value || '0');
      const make = results.find((r: any) => r.Variable === 'Make')?.Value || 'Unknown';
      const model = results.find((r: any) => r.Variable === 'Model')?.Value || 'Unknown';
      const trim = results.find((r: any) => r.Variable === 'Trim')?.Value;
      
      if (year === 0 || make === 'Unknown' || model === 'Unknown') {
        throw new Error('Incomplete vehicle information from VIN');
      }
      
      console.log(`✅ VIN decoded: ${year} ${make} ${model}`);
      return { year, make, model, trim };
    }
    
    throw new Error('Invalid VIN decode response');
    
  } catch (error) {
    console.error('❌ VIN decoding failed:', error);
    
    // Fallback: extract basic info from VIN structure
    const currentYear = new Date().getFullYear();
    const estimatedYear = Math.max(2000, currentYear - 10); // Assume recent vehicle
    
    console.log(`⚠️ Using fallback vehicle info: ${estimatedYear} Generic Vehicle`);
    return {
      year: estimatedYear,
      make: 'Generic',
      model: 'Vehicle'
    };
  }
}

/**
 * Creates fallback overlay pack when generation fails
 */
function createFallbackOverlayPack(repairType: string): OverlayPack {
  return {
    id: `fallback_${repairType}`,
    vehicle_family: 'generic_vehicle',
    workspace_type: 'engine_front',
    workspace_svg: `
      <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
        <rect x="100" y="100" width="800" height="400" fill="none" stroke="#000" stroke-width="2"/>
        <text x="500" y="300" text-anchor="middle" font-family="Arial" font-size="24">
          Generic Workspace - Overlay Generation Failed
        </text>
      </svg>
    `,
    baseline_dimensions: { width: 1000, height: 600 },
    parts: {
      'generic_part': {
        polygon: [
          { x: 0.4, y: 0.4 },
          { x: 0.6, y: 0.4 },
          { x: 0.6, y: 0.6 },
          { x: 0.4, y: 0.6 }
        ],
        glow_color: '#00FFFF',
        part_type: 'generic',
        accessibility: 'moderate'
      }
    },
    generated_at: new Date().toISOString(),
    gpt_model: 'fallback',
    usage_count: 0
  };
}

/**
 * Gets overlay pack by vehicle family and workspace (for direct access)
 */
export async function getOverlayPackByFamily(
  vehicleFamily: string,
  workspaceType: string
): Promise<OverlayPack | null> {
  
  try {
    const { data, error } = await supabase
      .from('overlay_packs')
      .select('*')
      .eq('vehicle_family', vehicleFamily)
      .eq('workspace_type', workspaceType)
      .limit(1);
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    return data[0];
    
  } catch (error) {
    console.error('Failed to get overlay pack:', error);
    return null;
  }
}

/**
 * Enhanced repair task retrieval with overlay integration
 */
export async function getRepairTaskWithOverlay(id: string): Promise<{
  repairTask: RepairTask | null;
  overlayPack: OverlayPack | null;
}> {
  console.log('🔄 getRepairTaskWithOverlay called with ID:', id);
  
  try {
    console.log('📋 Step 1: Getting repair task...');
    const repairTask = await getRepairTaskById(id);
    console.log('📊 Repair task result:', {
      found: !!repairTask,
      name: repairTask?.name,
      stepsCount: repairTask?.steps?.length || 0
    });
    
    if (!repairTask) {
      console.error('❌ Repair task not found for ID:', id);
      return { repairTask: null, overlayPack: null };
    }
    
    // For AI-generated tasks, extract VIN and repair type
    if (id.startsWith('gpt-')) {
      console.log('🤖 Processing AI-generated task...');
      const parts = id.split('-');
      if (parts.length >= 3) {
        const repairType = parts[1];
        const vin = parts.slice(2).join('-');
        console.log('📋 Extracted from AI task ID:', { repairType, vin });
        
        console.log('🔄 Step 2a: Decoding VIN for vehicle info...');
        const vehicleInfo = await decodeVINToVehicleInfo(vin);
        console.log('🚗 Vehicle info decoded:', vehicleInfo);
        
        console.log('🔄 Step 2b: Classifying vehicle family...');
        const vehicleClassification = await getCachedVehicleClassification(
          vehicleInfo.year,
          vehicleInfo.make,
          vehicleInfo.model
        );
        console.log('🏷️ Vehicle classification:', vehicleClassification);
        
        console.log('🔄 Step 2c: Determining workspace type...');
        const workspaceType = determineWorkspaceForRepair(repairType);
        console.log('🏭 Workspace type determined:', workspaceType);
        
        console.log('🔄 Step 2d: Getting/generating overlay pack...');
        const overlayPack = await getOrGenerateOverlayPack(
          vehicleClassification.family,
          workspaceType,
          repairType,
          vehicleInfo
        );
        console.log('🎨 Overlay pack result:', {
          found: !!overlayPack,
          id: overlayPack?.id,
          hasWorkspaceSvg: !!overlayPack?.workspace_svg,
          hasImageUrl: !!overlayPack?.image_url,
          partsCount: overlayPack ? Object.keys(overlayPack.parts).length : 0
        });
        
        console.log('✅ AI task processing completed successfully');
        return { repairTask, overlayPack };
      }
    }
    
    // For regular tasks, try to find matching overlay pack
    console.log('📋 Processing regular database task...');
    const workspaceType = determineWorkspaceForRepair(repairTask.name.toLowerCase());
    console.log('🏭 Workspace type for regular task:', workspaceType);
    const overlayPack = await getOverlayPackByFamily('generic_vehicle', workspaceType);
    console.log('🎨 Regular task overlay pack:', !!overlayPack ? 'found' : 'not found');
    
    return { repairTask, overlayPack };
    
  } catch (error) {
    console.error('❌ getRepairTaskWithOverlay failed:', {
      taskId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    const repairTask = await getRepairTaskById(id);
    return { repairTask, overlayPack: null };
  }
}

/**
 * Get difficulty level for repair type
 */
function getDifficultyForRepairType(repairType: string): 'Easy' | 'Medium' | 'Hard' {
  const difficultyMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
    brake_pads: 'Medium',
    oil_change: 'Easy',
    battery_replacement: 'Easy',
    air_filter: 'Easy',
    spark_plugs: 'Medium'
  };
  
  return difficultyMap[repairType] || 'Medium';
}