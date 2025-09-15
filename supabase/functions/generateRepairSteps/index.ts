import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VinData {
  make: string;
  model: string;
  year: string;
  engine_type: string;
}

interface RepairStep {
  instruction: string;
  tool: string;
  part_name: string;
  overlay_target: string;
}

interface RequestBody {
  vin: string;
  repair_type: string;
}

// Rate limiting utility with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      const isRateLimit = (error as any).status === 429 || 
                         (error as any).code === 'rate_limit_exceeded' ||
                         (error as Error).message?.includes('Rate limit') ||
                         (error as Error).message?.includes('Too Many Requests');
      
      if (!isRateLimit || attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
      console.log(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Unknown error occurred during retry');
}

// GPT Prompts for each repair type
const GPT_PROMPTS = {
  brake_pads: (vehicleData: VinData) => 
    `You are an automotive expert with detailed knowledge of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.engine_type} engine. Provide step-by-step instructions to change the front brake pads specific to this vehicle model.

REQUIREMENTS:
- Use exact part locations and procedures for this specific vehicle
- Include vehicle-specific access points and tool requirements
- Specify exact overlay targets for AR highlighting

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no backticks.

Output format: [{ "instruction": "detailed step description with vehicle-specific details", "part_name": "exact component name", "tool": "specific tool needed", "overlay_target": "precise AR target location" }]

Use these overlay targets based on exact locations in ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: wheel_bolts, tire, brake_caliper, brake_pads, rotor, jack_point, lug_wrench_position`,
    
  oil_change: (vehicleData: VinData) => 
    `You are an automotive expert with detailed knowledge of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.engine_type} engine. Provide step-by-step oil change instructions specific to this vehicle.

REQUIREMENTS:
- Specify exact drain plug location for this vehicle model
- Include vehicle-specific oil filter type and location
- Provide exact oil capacity and grade for this engine
- Detail vehicle-specific access points

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no backticks.

Output format: [{ "instruction": "detailed step with vehicle-specific locations", "part_name": "exact component name", "tool": "specific tool needed", "overlay_target": "precise AR target location" }]

Use overlay targets for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: drain_plug, oil_filter, oil_cap, dipstick, oil_pan, filter_wrench_position`,
    
  battery_replacement: (vehicleData: VinData) => 
    `You are an automotive expert with detailed knowledge of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.engine_type} engine. Provide battery replacement instructions specific to this vehicle.

REQUIREMENTS:
- Specify exact battery location in this vehicle model
- Include vehicle-specific terminal configuration
- Detail any vehicle-specific access requirements or covers
- Mention exact battery group size for this vehicle

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no backticks.

Output format: [{ "instruction": "detailed step with vehicle-specific details", "part_name": "exact component name", "tool": "specific tool needed", "overlay_target": "precise AR target location" }]

Use overlay targets for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: battery, positive_terminal, negative_terminal, hold_down_bracket, battery_cover, terminal_protectors`,
    
  air_filter: (vehicleData: VinData) => 
    `You are an automotive expert with detailed knowledge of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.engine_type} engine. Provide air filter replacement instructions specific to this vehicle.

REQUIREMENTS:
- Specify exact air filter housing location in this vehicle's engine bay
- Include vehicle-specific clip types and access methods
- Detail exact filter part number or specifications
- Mention any vehicle-specific covers or obstacles

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no backticks.

Output format: [{ "instruction": "detailed step with vehicle-specific locations", "part_name": "exact component name", "tool": "specific tool needed", "overlay_target": "precise AR target location" }]

Use overlay targets for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: air_filter_box, filter_clips, air_filter_element, intake_tube, housing_cover`,
    
  spark_plugs: (vehicleData: VinData) => 
    `You are an automotive expert with detailed knowledge of ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} with ${vehicleData.engine_type} engine. Provide spark plug replacement instructions specific to this vehicle.

REQUIREMENTS:
- Specify exact spark plug locations for this engine configuration
- Include vehicle-specific ignition coil removal procedures
- Detail exact spark plug gap and torque specifications
- Mention any vehicle-specific access challenges

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no backticks.

Output format: [{ "instruction": "detailed step with vehicle-specific procedures", "part_name": "exact component name", "tool": "specific tool needed", "overlay_target": "precise AR target location" }]

Use overlay targets for ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: ignition_coil, spark_plug_well, spark_plug_socket, torque_wrench, coil_connector, engine_cover`
};

async function decodeVin(vin: string): Promise<VinData> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.Results) {
    throw new Error('Invalid VIN or NHTSA API error');
  }
  
  const results = data.Results;
  const makeResult = results.find((r: any) => r.Variable === 'Make');
  const modelResult = results.find((r: any) => r.Variable === 'Model');
  const yearResult = results.find((r: any) => r.Variable === 'Model Year');
  const engineResult = results.find((r: any) => r.Variable === 'Engine Configuration' || r.Variable === 'Displacement (L)');
  
  return {
    make: makeResult?.Value || 'Unknown',
    model: modelResult?.Value || 'Unknown', 
    year: yearResult?.Value || 'Unknown',
    engine_type: engineResult?.Value || 'Unknown'
  };
}

async function generateRepairStepsWithGPT(vehicleData: VinData, repairType: string): Promise<RepairStep[]> {
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepseekKey) {
    throw new Error('DeepSeek API key not configured');
  }
  
  const prompt = GPT_PROMPTS[repairType as keyof typeof GPT_PROMPTS];
  if (!prompt) {
    throw new Error(`Unsupported repair type: ${repairType}`);
  }
  
  // Enhanced retry with exponential backoff for rate limiting
  const response = await withRetry(async () => {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt(vehicleData) }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60s
      console.log(`⏳ Rate limited, waiting ${waitTime}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      throw new Error('Rate limit - retry needed');
    }
    
    if (!res.ok) {
      throw new Error(`DeepSeek API error: ${res.status} ${res.statusText}`);
    }
    
    return res;
  }, 3, 2000); // 3 retries with 2s base delay
  
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content returned from DeepSeek');
  }
  
  // Simple and reliable JSON parsing approach
  try {
    let cleanContent = content.trim();
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Simple string replacement approach - more reliable than complex regex
    cleanContent = cleanContent
      .trim()
      .split('\n').join('\\n')  // Escape newlines
      .split('\r').join('\\r')  // Escape carriage returns  
      .split('\t').join('\\t')  // Escape tabs
      .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    
    console.log('🔄 Attempting to parse cleaned content...');
    const steps = JSON.parse(cleanContent);
    console.log('✅ Successfully parsed', Array.isArray(steps) ? steps.length : 1, 'repair steps');
    return Array.isArray(steps) ? steps : [steps];
    
  } catch (error) {
    console.error('❌ Primary parsing failed:', (error as Error).message);
    console.error('📄 Content length:', content.length);
    console.error('🔍 First 300 chars:', content.substring(0, 300));
    console.error('🔍 Last 300 chars:', content.substring(Math.max(0, content.length - 300)));
    
    // Fallback: Extract JSON array manually
    try {
      console.log('🔄 Attempting array extraction...');
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        let extracted = arrayMatch[0]
          .split('\n').join('\\n')
          .split('\r').join('\\r') 
          .split('\t').join('\\t')
          .replace(/,(\s*[}\]])/g, '$1');
        
        const steps = JSON.parse(extracted);
        console.log('✅ Array extraction successful:', steps.length, 'steps');
        return Array.isArray(steps) ? steps : [steps];
      }
    } catch (secondError) {
      console.error('❌ Array extraction failed:', (secondError as Error).message);
    }
    
    // Final fallback: Manual field extraction
    try {
      console.log('🔄 Attempting manual field extraction...');
      const instructions = [...content.matchAll(/"instruction":\s*"([^"\\]*(\\.[^"\\]*)*)"/g)];
      const parts = [...content.matchAll(/"part_name":\s*"([^"\\]*(\\.[^"\\]*)*)"/g)];
      const tools = [...content.matchAll(/"tool":\s*"([^"\\]*(\\.[^"\\]*)*)"/g)];
      const overlays = [...content.matchAll(/"overlay_target":\s*"([^"\\]*(\\.[^"\\]*)*)"/g)];
      
      if (instructions.length > 0 && parts.length > 0 && tools.length > 0 && overlays.length > 0) {
        const minLength = Math.min(instructions.length, parts.length, tools.length, overlays.length);
        const steps = [];
        
        for (let i = 0; i < minLength; i++) {
          steps.push({
            instruction: instructions[i][1] || '',
            part_name: parts[i][1] || '',
            tool: tools[i][1] || '',
            overlay_target: overlays[i][1] || ''
          });
        }
        
        if (steps.length > 0) {
          console.log('✅ Manual extraction successful:', steps.length, 'steps');
          return steps;
        }
      }
    } catch (thirdError) {
      console.error('❌ Manual extraction failed:', (thirdError as Error).message);
    }
    
    throw new Error(`Failed to parse DeepSeek response: ${(error as Error).message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { vin, repair_type }: RequestBody = await req.json();
    
    if (!vin || !repair_type) {
      return new Response(
        JSON.stringify({ error: 'VIN and repair_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    const { data: cachedData, error: cacheError } = await supabaseClient
      .from('gpt_repair_cache')
      .select('gpt_response')
      .eq('vin', vin)
      .eq('repair_type', repair_type)
      .single();

    if (cachedData && !cacheError) {
      console.log('Returning cached result for VIN:', vin, 'repair_type:', repair_type);
      return new Response(
        JSON.stringify(cachedData.gpt_response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not cached, decode VIN and generate new steps
    console.log('Cache miss, generating new repair steps for VIN:', vin);
    
    const vehicleData = await decodeVin(vin);
    const repairSteps = await generateRepairStepsWithGPT(vehicleData, repair_type);
    
    // Cache the result
    const { error: upsertError } = await supabaseClient
      .from('gpt_repair_cache')
      .upsert({
        vin,
        repair_type,
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        engine_type: vehicleData.engine_type,
        gpt_response: repairSteps
      }, {
        onConflict: 'vin,repair_type'
      });

    if (upsertError) {
      console.error('Failed to cache result:', upsertError);
      // Don't fail the request if caching fails, just log it
    } else {
      console.log('✅ Repair steps cached successfully for:', vin, repair_type);
    }

    return new Response(
      JSON.stringify(repairSteps),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generateRepairSteps:', error);
    if (error.message === 'Rate limit exceeded. Please try again later.') {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}) 