/**
 * Gemini API Client
 * 
 * Provides text generation via Google Gemini models.
 * Primary: gemini-3.5-flash
 * Fallback: gemini-3.5-flash-lite (lower-latency fallback for overloads)
 */

// Model configs with their correct API versions.
const PRIMARY = {
  id: 'gemini-3.5-flash',
  base: 'https://generativelanguage.googleapis.com/v1beta/models',
  supportsSystemInstruction: true,
};
const FALLBACK = {
  id: 'gemini-3.5-flash-lite',
  base: 'https://generativelanguage.googleapis.com/v1beta/models',
  supportsSystemInstruction: true,
};

export type GeminiModel = 'fast' | 'thinking';

type GeminiGenerationConfig = {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  thinkingConfig?: { thinkingBudget: number };
  responseMimeType?: 'application/json';
};

export type GeminiOptions = {
  responseMimeType?: 'application/json';
};

type GeminiRequestPayload = {
  contents: Array<{
    role: 'user';
    parts: Array<{ text: string }>;
  }>;
  generationConfig: GeminiGenerationConfig;
  system_instruction?: {
    parts: Array<{ text: string }>;
  };
};

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
  model: GeminiModel = 'fast',
  options: GeminiOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // Fast mode favors the low-latency model first so scheduled functions do not
  // spend most of their timeout budget waiting on a full-model timeout.
  const models = model === 'fast' ? [FALLBACK, PRIMARY] : [PRIMARY, FALLBACK];

  for (const currentModel of models) {
    try {
      const result = await callGemini(
        apiKey,
        currentModel.id,
        currentModel.base,
        currentModel.supportsSystemInstruction,
        systemPrompt,
        userPrompt,
        model,
        options
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isOverloaded = message.includes('503') || message.includes('429');
      const isLastModel = currentModel === FALLBACK;

      if (isOverloaded && !isLastModel) {
        console.warn(`[GEMINI] ${currentModel.id} overloaded, falling back to ${FALLBACK.id}`);
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
  apiBase: string,
  supportsSystemInstruction: boolean,
  systemPrompt: string,
  userPrompt: string,
  mode: GeminiModel,
  options: GeminiOptions
): Promise<string> {
  const apiUrl = `${apiBase}/${modelId}:generateContent`;
  const TIMEOUT_MS = 20000; // 20s for any model

  // Build generation config
  const generationConfig: GeminiGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 8192,
    topP: 0.9,
  };

  // Disable thinking for fast mode (only supported on 2.5+)
  if (mode === 'fast' && modelId.startsWith('gemini-2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const requestPrompt = supportsSystemInstruction
    ? userPrompt
    : `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`;
  const payload: GeminiRequestPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: requestPrompt }],
      },
    ],
    generationConfig,
  };

  if (supportsSystemInstruction) {
    payload.system_instruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
      console.error(`[GEMINI] ${modelId} error:`, status, errorText.slice(0, 200));
      throw new Error(`Gemini API error: ${status} (${modelId})`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error(`[GEMINI] ${modelId} returned no text:`, JSON.stringify(data).slice(0, 200));
      throw new Error('Gemini returned no text');
    }

    console.log(`[GEMINI] ${modelId} responded (${text.length} chars)`);
    return text;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[GEMINI] ${modelId} timed out after ${TIMEOUT_MS}ms`);
      throw new Error(`Gemini API error: 503 (${modelId})`); // Treat timeout as overloaded for fallback
    }
    throw err;
  }
}
