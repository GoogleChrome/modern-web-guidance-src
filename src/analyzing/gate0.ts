import type { Gate0Classification, Gate0Entry } from './schema.ts';
import { getGeminiApiKey } from './judge.ts';

export {
  GATE0_PROMPT_VERSION,
  GATE0_SYSTEM_PROMPT,
} from './prompts.ts';
import {
  GATE0_PROMPT_VERSION,
  GATE0_SYSTEM_PROMPT,
} from './prompts.ts';
export const GATE0_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const GATE0_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    classification: {
      type: 'STRING',
      enum: ['detectable', 'ui-recipe-multi-part', 'skip-no-old-way'],
    },
    brownfieldTarget: { type: 'STRING' },
    evidenceFromGuide: { type: 'STRING' },
    reason: { type: 'STRING' },
  },
  required: ['classification', 'brownfieldTarget', 'evidenceFromGuide', 'reason'],
};

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
}

export function formatGate0Prompt(guide: Gate0GuideInput): string {
  return `## Guide: ${guide.guideId} (Category: ${guide.category})

### Full Guide Markdown:
\`\`\`markdown
${guide.markdownContent}
\`\`\`

Analyze the entire guide markdown above and classify it into one of: 'detectable', 'ui-recipe-multi-part', or 'skip-no-old-way'.
Identify the brownfieldTarget, cite evidenceFromGuide (quote or specific summary of the legacy workaround or lack thereof), and provide a 1-sentence reason.`;
}

export function buildGate0RequestBody(guide: Gate0GuideInput): unknown {
  return {
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
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

export function parseGate0Response(
  rawText: string,
  guideId: string,
): {
  classification: Gate0Classification;
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

  if (typeof rec.brownfieldTarget !== 'string' || !rec.brownfieldTarget.trim()) {
    throw new Error(`Gate 0 response missing string 'brownfieldTarget' for guide ${guideId}`);
  }

  if (typeof rec.evidenceFromGuide !== 'string') {
    throw new Error(`Gate 0 response missing string 'evidenceFromGuide' for guide ${guideId}`);
  }

  if (typeof rec.reason !== 'string' || !rec.reason.trim()) {
    throw new Error(`Gate 0 response missing string 'reason' for guide ${guideId}`);
  }

  return {
    classification,
    brownfieldTarget: rec.brownfieldTarget.trim(),
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

  const body = buildGate0RequestBody(guide);
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
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gate 0 classifyGuide returned empty candidate text for guide ${guide.guideId}`,
    );
  }

  const parsed = parseGate0Response(text, guide.guideId);

  return {
    guideId: guide.guideId,
    guideHash: guide.guideHash,
    classification: parsed.classification,
    brownfieldTarget: parsed.brownfieldTarget,
    evidenceFromGuide: parsed.evidenceFromGuide,
    reason: parsed.reason,
    gate0PromptVersion: GATE0_PROMPT_VERSION,
  };
}
