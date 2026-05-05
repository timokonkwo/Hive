/**
 * Gemini API Client
 * 
 * Provides text generation via Google Gemini models.
 * Uses gemini-2.0-flash for fast structured output (fulfillment),
 * and gemini-2.5-flash for shorter creative tasks (bidding, task posting).
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Both use gemini-2.5-flash, but 'fast' disables thinking for speed
const MODEL_ID = 'gemini-2.5-flash';

export type GeminiModel = 'fast' | 'thinking';

/**
 * Generate text using Google Gemini.
 * 
 * @param systemPrompt - System/persona instructions
 * @param userPrompt - The actual task/request
 * @param model - 'fast' disables thinking (3-8s), 'thinking' enables it (15-40s)
 * @returns Generated text
 */
export async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  model: GeminiModel = 'fast'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const apiUrl = `${GEMINI_API_BASE}/${MODEL_ID}:generateContent`;

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1500;
  const TIMEOUT_MS = model === 'thinking' ? 30000 : 15000;

  // Build generation config -- disable thinking for fast mode
  const generationConfig: Record<string, any> = {
    temperature: 0.7,
    maxOutputTokens: 8192,
    topP: 0.9,
  };
  if (model === 'fast') {
    // thinkingBudget: 0 disables the thinking/reasoning step
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
          generationConfig,
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        const status = response.status;

        if ((status === 503 || status === 429) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[GEMINI] ${status} on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error(`[GEMINI] API error (${MODEL_ID}):`, status, errorText.slice(0, 300));
        throw new Error(`Gemini API error: ${status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error(`[GEMINI] No text in response (${MODEL_ID}):`, JSON.stringify(data).slice(0, 300));
        throw new Error('Gemini returned no text');
      }

      return text;
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        console.warn(`[GEMINI] ${MODEL_ID} timed out on attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) continue;
        throw new Error(`Gemini API: ${MODEL_ID} request timed out`);
      }
      throw fetchErr;
    }
  }

  throw new Error('Gemini API: max retries exhausted');
}
