/**
 * Gemini API Client
 * 
 * Minimal wrapper around the Google Gemini API for text generation.
 * Uses Gemini 2.5 Flash for cost efficiency (free tier).
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generate text using Google Gemini 2.5 Flash.
 * 
 * @param systemPrompt - System/persona instructions
 * @param userPrompt - The actual task/request
 * @returns Generated text
 */
export async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2s, 4s, 8s

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;

      // Retry on 503 (overloaded) and 429 (rate limited)
      if ((status === 503 || status === 429) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[GEMINI] ${status} on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('[GEMINI] API error:', status, errorText.slice(0, 300));
      throw new Error(`Gemini API error: ${status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[GEMINI] No text in response:', JSON.stringify(data).slice(0, 300));
      throw new Error('Gemini returned no text');
    }

    return text;
  }

  throw new Error('Gemini API: max retries exhausted');
}
