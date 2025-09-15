const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SpeakRequest {
  text: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const { text }: SpeakRequest = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response("Text is required", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // TTS is now handled client-side with Expo Speech
    console.log('🎯 TTS request received but handled client-side with Expo Speech');
    console.log('📝 Text length:', text.length);

    // Return success response indicating client-side TTS is used
    return new Response(JSON.stringify({
      message: "TTS is now handled client-side with Expo Speech (device native TTS)",
      text_length: text.length,
      method: "expo-speech"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error in speak function:', error);
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});