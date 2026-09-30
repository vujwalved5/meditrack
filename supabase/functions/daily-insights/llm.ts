// ============================================================
// llm.ts — Provider abstraction (Gemini / Anthropic), retry, fallback
// ============================================================
import { SYSTEM_PROMPT } from './prompts.ts';

type Provider = 'gemini' | 'anthropic';

interface LLMConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

function getConfig(): LLMConfig {
  const provider = (Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase() as Provider;
  let model: string;
  let apiKey: string;

  if (provider === 'anthropic') {
    // Current Anthropic Claude model IDs (verify at https://docs.anthropic.com/en/docs/models-overview)
    model = Deno.env.get('AI_MODEL') ?? 'claude-haiku-4-5-20251001';
    apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  } else {
    // Gemini — current model IDs: https://ai.google.dev/gemini-api/docs/models/gemini
    // gemini-2.5-flash is the default (fast, cost-effective)
    model = Deno.env.get('AI_MODEL') ?? 'gemini-2.5-flash';
    apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  }

  return { provider, model, apiKey };
}

/**
 * Parse LLM response text into a JSON object robustly.
 * Strips code fences and takes the substring from first '{' to last '}'.
 */
export function parseJsonResponse(text: string): unknown {
  // Strip code fences
  let s = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('No JSON object found in LLM response');
  }
  s = s.substring(firstBrace, lastBrace + 1);
  return JSON.parse(s);
}

/**
 * Make one LLM call with a 30s timeout.
 * Returns the parsed JSON object or throws.
 */
async function callLLMOnce(config: LLMConfig, userPrompt: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    let response: Response;

    if (config.provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1500,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text().catch(() => '(no body)');
        throw new Error(`Anthropic API error ${response.status}: ${err.substring(0, 200)}`);
      }
      const data = await response.json();
      const text: string = data?.content?.[0]?.text ?? '';
      return parseJsonResponse(text);

    } else {
      // Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
      const is25Flash = config.model.includes('2.5') && config.model.toLowerCase().includes('flash');

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          ...(is25Flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text().catch(() => '(no body)');
        throw new Error(`Gemini API error ${response.status}: ${err.substring(0, 200)}`);
      }
      const data = await response.json();
      const cand = data?.candidates?.[0];
      if (cand?.finishReason && cand.finishReason !== 'STOP') {
        console.warn(`[llm] finishReason=${cand.finishReason}`);
      }
      const text: string = (cand?.content?.parts ?? [])
        .filter((p: any) => !p.thought)
        .map((p: any) => p.text ?? '')
        .join('');
      return parseJsonResponse(text);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export interface LLMResult<T> {
  data: T;
  model: string;
  usedFallback: boolean;
}

/**
 * Call the LLM with one retry. On second failure, use the deterministic fallback.
 * Never logs API keys or full prompts.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callLLM<T>(
  userPrompt: string,
  validator: (obj: unknown) => obj is T,
  fallback: () => T,
): Promise<LLMResult<T>> {
  const config = getConfig();
  const backupModel = Deno.env.get('AI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';
  const attempts: { cfg: LLMConfig; delay: number }[] = [
    { cfg: config, delay: 0 },
    { cfg: config, delay: 2000 },
  ];
  if (config.provider === 'gemini' && backupModel !== config.model) {
    attempts.push({ cfg: { ...config, model: backupModel }, delay: 3000 });
  }

  for (let i = 0; i < attempts.length; i++) {
    const { cfg, delay } = attempts[i];
    if (delay) await sleep(delay);
    try {
      const raw = await callLLMOnce(cfg, userPrompt);
      if (validator(raw)) {
        return { data: raw, model: cfg.model, usedFallback: false };
      }
      throw new Error('Validator rejected LLM response');
    } catch (err) {
      console.warn(`[llm] attempt ${i + 1} failed (${cfg.model}): ${(err as Error).message}`);
    }
  }

  console.warn(`[llm] all attempts failed. Using fallback.`);
  // Use deterministic fallback
  return { data: fallback(), model: 'fallback', usedFallback: true };
}
