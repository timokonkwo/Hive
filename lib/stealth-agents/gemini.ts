/**
 * Gemini API Client
 * 
 * Provides text generation via Google Gemini models.
 * Primary: gemini-2.5-flash (with thinkingBudget:0 for fast mode)
 * Fallback: gemini-1.5-flash (stable, for when 2.5 is overloaded)
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Primary model with thinking control
const PRIMARY_MODEL = 'gemini-2.5-flash';
// Fallback when primary is overloaded (503)
const FALLBACK_MODEL = 'gemini-1.5-flash';

export type GeminiModel = 'fast' | 'thinking';

/**
 * Generate text using Google Gemini.
 * Tries primary model first, falls back to secondary on 503/429.
 * 
 * @param systemPrompt - System/persona instructions
 * @param userPrompt - The actual task/request
 * @param model - 'fast' disables thinking (3-8s), 'thinking' enables it
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

  // Try primary model, then fallback
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const currentModel of models) {
    try {
      const result = await callGemini(apiKey, currentModel, systemPrompt, userPrompt, model);
      return result;
    } catch (err: any) {
      const isOverloaded = err.message?.includes('503') || err.message?.includes('429');
      const isLastModel = currentModel === FALLBACK_MODEL;

      if (isOverloaded && !isLastModel) {
        console.warn(`[GEMINI] ${currentModel} overloaded, falling back to ${FALLBACK_MODEL}`);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Gemini API: all models failed');
}

/**
 * Call a specific Gemini model with retries and timeout.
 */
async function callGemini(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  mode: GeminiModel
): Promise<string> {
  const apiUrl = `${GEMINI_API_BASE}/${modelId}:generateContent`;
  const TIMEOUT_MS = 20000; // 20s for any model

  // Build generation config
  const generationConfig: Record<string, any> = {
    temperature: 0.7,
    maxOutputTokens: 8192,
    topP: 0.9,
  };

  // Disable thinking for fast mode (only supported on 2.5+)
  if (mode === 'fast' && modelId.startsWith('gemini-2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

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
      console.error(`[GEMINI] ${modelId} error:`, status, errorText.slice(0, 200));
      throw new Error(`Gemini API error: ${status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error(`[GEMINI] ${modelId} returned no text:`, JSON.stringify(data).slice(0, 200));
      throw new Error('Gemini returned no text');
    }

    console.log(`[GEMINI] ${modelId} responded (${text.length} chars)`);
    return text;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.warn(`[GEMINI] ${modelId} timed out after ${TIMEOUT_MS}ms`);
      throw new Error(`Gemini API error: 503`); // Treat timeout as overloaded for fallback
    }
    throw err;
  }
}
