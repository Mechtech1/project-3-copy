/**
 * Vehicle Classification Service
 * Uses DeepSeek to classify any vehicle into families for overlay pack compatibility
 */

import { rateLimitedChatCompletion } from './rateLimitService';
import { VehicleClassification } from '@/types';

let deepseekClient: any = null;

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

// Cache for vehicle classifications to avoid repeated API calls
const classificationCache = new Map<string, VehicleClassification>();

/**
 * Classifies a vehicle into a family for overlay pack compatibility
 */
export async function classifyVehicleFamily(
  year: number,
  make: string,
  model: string
): Promise<VehicleClassification> {
  
  const cacheKey = `${year}_${make}_${model}`.toLowerCase();
  
  // Check cache first
  if (classificationCache.has(cacheKey)) {
    return classificationCache.get(cacheKey)!;
  }
  
  try {
    const prompt = `Classify this vehicle into a family for automotive repair overlay compatibility:

Vehicle: ${year} ${make} ${model}

Analyze the vehicle's architecture and classify it into a family that shares similar:
- Platform/chassis design
- Engine bay layout
- Undercarriage structure
- Interior configuration

Return ONLY a JSON object with this exact structure:
{
  "family": "descriptive_family_name",
  "platform": "platform_code_or_name",
  "engine_layout": "transverse|longitudinal|mid|rear",
  "body_style": "sedan|suv|truck|hatchback|coupe|wagon|convertible",
  "confidence": 0.95
}

Examples:
- Honda Accord/Civic/CR-V → "honda_compact_platform"
- Ford F-150/F-250 → "ford_full_size_truck"
- BMW 3/5 Series → "bmw_rwd_platform"
- Toyota Camry/RAV4 → "toyota_tnga_platform"

Focus on mechanical similarity for repair procedures, not just brand.`;

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
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    if (!content) {
      throw new Error('No response from DeepSeek');
    }

    // Strip markdown code block wrappers if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const classification: VehicleClassification = JSON.parse(cleanContent);
    
    // Validate response structure
    if (!classification.family || !classification.platform || !classification.engine_layout) {
      throw new Error('Invalid classification response structure');
    }
    
    // Cache the result
    classificationCache.set(cacheKey, classification);
    
    console.log(`✅ Vehicle classified using DeepSeek: ${year} ${make} ${model} → ${classification.family}`);
    return classification;
    
  } catch (error) {
    console.error('❌ Vehicle classification failed:', error);
    
    // Fallback classification based on make
    const fallbackClassification: VehicleClassification = {
      family: `${make.toLowerCase()}_generic_family`,
      platform: 'unknown_platform',
      engine_layout: 'transverse',
      body_style: 'sedan',
      confidence: 0.3
    };
    
    classificationCache.set(cacheKey, fallbackClassification);
    return fallbackClassification;
  }
}

/**
 * Gets cached vehicle classification if available
 */
export async function getCachedVehicleClassification(
  year: number,
  make: string,
  model: string
): Promise<VehicleClassification> {
  return await classifyVehicleFamily(year, make, model);
}

/**
 * Determines workspace type based on repair type
 */
export function determineWorkspaceForRepair(repairType: string): string {
  const repair = repairType.toLowerCase();
  
  // Engine bay repairs
  if (repair.includes('battery') || 
      repair.includes('alternator') || 
      repair.includes('starter') ||
      repair.includes('radiator') ||
      repair.includes('belt') ||
      repair.includes('hose') ||
      repair.includes('spark') ||
      repair.includes('ignition') ||
      repair.includes('air_filter') ||
      repair.includes('engine')) {
    return 'engine_front';
  }
  
  // Undercarriage repairs
  if (repair.includes('oil') ||
      repair.includes('transmission') ||
      repair.includes('exhaust') ||
      repair.includes('suspension') ||
      repair.includes('undercarriage') ||
      repair.includes('differential')) {
    return 'undercarriage';
  }
  
  // Wheel/brake repairs
  if (repair.includes('brake') ||
      repair.includes('wheel') ||
      repair.includes('tire') ||
      repair.includes('rotor') ||
      repair.includes('caliper')) {
    return 'wheel_assembly';
  }
  
  // Interior repairs
  if (repair.includes('dashboard') ||
      repair.includes('interior') ||
      repair.includes('seat') ||
      repair.includes('console') ||
      repair.includes('radio') ||
      repair.includes('hvac')) {
    return 'interior';
  }
  
  // Trunk/rear repairs
  if (repair.includes('trunk') ||
      repair.includes('taillight') ||
      repair.includes('rear') ||
      repair.includes('hatch')) {
    return 'trunk_rear';
  }
  
  // Default to engine front for unknown repairs
  return 'engine_front';
}

/**
 * Gets all supported workspace types
 */
export function getSupportedWorkspaceTypes(): string[] {
  return [
    'engine_front',
    'undercarriage', 
    'wheel_assembly',
    'interior',
    'trunk_rear'
  ];
}

/**
 * Clears the classification cache (useful for testing)
 */
export function clearClassificationCache(): void {
  classificationCache.clear();
}
