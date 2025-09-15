import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RepairContext {
  vehicle: {
    make: string;
    model: string;
    year: number;
    vin?: string;
  };
  repairTask: {
    name: string;
    description: string;
    estimatedTime: number;
  };
  currentStep: {
    stepNumber: number;
    instruction: string;
    toolRequired?: string;
    partName: string;
    audioScript: string;
  };
  currentStepIndex: number;
  completedSteps: string[];
}

interface RequestBody {
  userQuestion: string;
  repairContext: RepairContext;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

async function generateRepairAssistantResponse(
  userQuestion: string,
  context: RepairContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Create comprehensive system prompt with repair context
  const systemPrompt = `You are an expert automotive mechanic providing real-time guidance through AR camera repair sessions. You have deep knowledge of automotive systems and repair procedures.

CURRENT REPAIR CONTEXT:
- Vehicle: ${context.vehicle.year} ${context.vehicle.make} ${context.vehicle.model}
- Repair Task: ${context.repairTask.name}
- Current Step: ${context.currentStep.stepNumber}/${context.currentStepIndex + 1}
- Step Instruction: ${context.currentStep.instruction}
- Part Being Worked On: ${context.currentStep.partName}
- Tool Required: ${context.currentStep.toolRequired || 'None specified'}
- Completed Steps: ${context.completedSteps.join(', ') || 'None yet'}

IMPORTANT GUIDELINES:
1. **Voice-First**: Keep responses conversational and under 3 sentences when possible - this is spoken aloud
2. **Visual Context**: The user is looking through an AR camera that highlights parts in blue boxes
3. **Safety First**: Always prioritize safety and suggest professional help for dangerous tasks
4. **Be Specific**: Reference the exact part, tool, or location when answering
5. **Encouraging**: Be supportive and patient like a good mentor mechanic
6. **Practical**: Give actionable, step-by-step guidance
7. **Ask Clarifying Questions**: If unclear, ask specific questions to help better

RESPONSE TYPES YOU CAN PROVIDE:
- Answer ANY automotive question (not just current step)
- Explain WHY something is done (educational)
- Troubleshooting tips and diagnostics
- Safety warnings and precautions
- Tool usage and alternatives
- Part identification and location
- Next steps and what to expect
- Estimated time and difficulty

CURRENT USER QUESTION: "${userQuestion}"

Respond as a knowledgeable, friendly mechanic who can see what the user is doing through their AR camera.`;

  // Prepare conversation with system prompt and history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8), // Keep recent conversation context
    { role: 'user', content: userQuestion }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5', // Use latest GPT-5 for best repair knowledge
      messages,
      temperature: 0.7,
      max_completion_tokens: 200, // Keep responses concise for voice
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    })
  });

  if (!response.ok) {
    console.error('OpenAI API error:', response.status, response.statusText);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from OpenAI');
  }

  return content.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userQuestion, repairContext, conversationHistory }: RequestBody = await req.json();

    if (!userQuestion || !repairContext) {
      return new Response(
        JSON.stringify({ error: 'userQuestion and repairContext are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Repair AI Assistant called with:', {
      vehicle: `${repairContext.vehicle.year} ${repairContext.vehicle.make} ${repairContext.vehicle.model}`,
      repair: repairContext.repairTask.name,
      step: repairContext.currentStep.stepNumber,
      question: userQuestion.substring(0, 100) + '...'
    });

    const response = await generateRepairAssistantResponse(
      userQuestion,
      repairContext,
      conversationHistory || []
    );

    console.log('Generated response:', response.substring(0, 100) + '...');

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in repair-ai-assistant:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate repair assistance',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}) 