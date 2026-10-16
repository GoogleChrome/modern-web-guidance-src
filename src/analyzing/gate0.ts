import type { Gate0Classification, Gate0Entry } from './schema.ts';
import { getGeminiApiKey } from './judge.ts';

export {
  GATE0_PROMPT_VERSION,
  GATE0_RESPONSE_SCHEMA,
  GATE0_SYSTEM_PROMPT,
  GATE0_THINKING_BUDGET,
  computeGate0PromptVersion,
  formatGate0Prompt,
} from './prompts.ts';
import {
  GATE0_PROMPT_VERSION,
  GATE0_RESPONSE_SCHEMA,
  GATE0_SYSTEM_PROMPT,
  GATE0_THINKING_BUDGET,
  computeGate0PromptVersion,
  formatGate0Prompt,
} from './prompts.ts';

export const GATE0_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface Gate0GuideInput {
  readonly guideId: string;
  readonly category: string;
  readonly guideHash: string;
  readonly markdownContent: string;
}

export interface Gate0Options {
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly maxRetries?: number;
  readonly model?: string;
  readonly enableSearchGrounding?: boolean;
}

export function buildGate0RequestBody(guide: Gate0GuideInput, options?: Gate0Options): unknown {
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: GATE0_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatGate0Prompt(guide) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GATE0_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: GATE0_THINKING_BUDGET },
    },
  };

  if (enableSearchGrounding) {
    body.tools = [{ googleSearch: {} }];
  }

  return body;
}

export function parseGate0Response(
  rawText: string,
  guideId: string,
): {
  classification: Gate0Classification;
  candidateTechniques: string[];
  borderline: boolean;
  brownfieldTarget: string;
  evidenceFromGuide: string;
  reason: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (err: unknown) {
    throw new Error(`Gate 0 response JSON parse error for guide ${guideId}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Gate 0 invalid response shape for guide ${guideId}: expected object`);
  }

  const rec = parsed as Record<string, unknown>;
  const classification = rec.classification;
  if (
    classification !== 'detectable' &&
    classification !== 'ui-recipe-multi-part' &&
    classification !== 'skip-no-old-way'
  ) {
    throw new Error(
      `Gate 0 response invalid classification '${String(classification)}' for guide ${guideId}`,
    );
  }

  if (!Array.isArray(rec.candidateTechniques)) {
    throw new Error(`Gate 0 response missing array 'candidateTechniques' for guide ${guideId}`);
  }
  const candidateTechniques = rec.candidateTechniques.map((t) => {
    if (typeof t !== 'string') {
      throw new Error(`Gate 0 candidateTechnique must be string for guide ${guideId}`);
    }
    return t.trim();
  });

  if (typeof rec.borderline !== 'boolean') {
    throw new Error(`Gate 0 response missing boolean 'borderline' for guide ${guideId}`);
  }
  const borderline = rec.borderline;

  if (typeof rec.brownfieldTarget !== 'string' || !rec.brownfieldTarget.trim()) {
    throw new Error(`Gate 0 response missing string 'brownfieldTarget' for guide ${guideId}`);
  }
  const brownfieldTarget = rec.brownfieldTarget.trim();

  if (typeof rec.evidenceFromGuide !== 'string') {
    throw new Error(`Gate 0 response missing string 'evidenceFromGuide' for guide ${guideId}`);
  }

  if (typeof rec.reason !== 'string' || !rec.reason.trim()) {
    throw new Error(`Gate 0 response missing string 'reason' for guide ${guideId}`);
  }

  return {
    classification,
    candidateTechniques,
    borderline,
    brownfieldTarget,
    evidenceFromGuide: rec.evidenceFromGuide.trim(),
    reason: rec.reason.trim(),
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  customFetch: typeof fetch,
  maxRetries = 8,
): Promise<Response> {
  let attempt = 0;
  let delayMs = 1500;

  while (true) {
    attempt++;
    try {
      const res = await customFetch(url, options);
      if (
        (res.status === 429 ||
          res.status === 500 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504) &&
        attempt <= maxRetries
      ) {
        await new Promise((r) => setTimeout(r, delayMs + Math.random() * 1000));
        delayMs = Math.min(delayMs * 2, 16000);
        continue;
      }
      return res;
    } catch (err: unknown) {
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs + Math.random() * 1000));
        delayMs = Math.min(delayMs * 2, 16000);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Classifies a single published guide via Gemini LLM using full markdown content.
 * Evaluates 1 guide per LLM call and fails loudly on API or schema errors.
 */
export async function classifyGuideGate0(
  guide: Gate0GuideInput,
  options?: Gate0Options,
): Promise<Gate0Entry> {
  const apiKey = getGeminiApiKey(options);
  const customFetch = options?.fetchFn ?? fetch;
  const model = options?.model ?? GATE0_MODEL;
  const maxRetries = options?.maxRetries ?? 8;

  const body = buildGate0RequestBody(guide, options);
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    customFetch,
    maxRetries,
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Gate 0 classifyGuide failed for ${guide.guideId} with HTTP ${res.status}: ${errText}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        webSearchQueries?: string[];
      };
    }>;
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gate 0 classifyGuide returned empty candidate text for guide ${guide.guideId}`,
    );
  }

  const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries ?? [];
  const parsed = parseGate0Response(text, guide.guideId);
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;

  return {
    guideId: guide.guideId,
    guideHash: guide.guideHash,
    classification: parsed.classification,
    candidateTechniques: parsed.candidateTechniques,
    borderline: parsed.borderline,
    brownfieldTarget: parsed.brownfieldTarget,
    evidenceFromGuide: parsed.evidenceFromGuide,
    reason: parsed.reason,
    gate0PromptVersion: computeGate0PromptVersion(0.0, enableSearchGrounding),
    webSearchQueries,
  };
}
