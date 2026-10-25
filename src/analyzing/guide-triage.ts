import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Gate0Classification, Gate0Entry, Gate0EvidenceSource } from './schema.ts';
import { getGeminiApiKey } from './detection-eval.ts';
import { ANALYZER_INTERNAL_DIR } from './paths.ts';

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

export const GUIDE_TRIAGE_MODEL = 'gemini-3.8-flash';
export const GATE0_MODEL = GUIDE_TRIAGE_MODEL;
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_EXPLAINERS_JSON_PATH = join(
  ANALYZER_INTERNAL_DIR,
  'findings',
  '2026-10-19-guide-explainers-171.json',
);

export interface ExplainerContextEntry {
  readonly combinedExcerpt: string;
  readonly explainerContextHash: string;
}

/**
 * Loads the guide explainer context map from disk if the file exists.
 * Returns an empty map if the file does not exist or has not been generated yet.
 */
export async function loadExplainerContextMap(
  explainersJsonPath: string = DEFAULT_EXPLAINERS_JSON_PATH,
): Promise<Map<string, ExplainerContextEntry>> {
  const map = new Map<string, ExplainerContextEntry>();
  let content: string;
  try {
    content = await readFile(explainersJsonPath, 'utf8');
  } catch {
    return map;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    throw new Error(`Failed to parse explainers JSON from ${explainersJsonPath}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid explainers JSON format at ${explainersJsonPath}: expected array or record`);
  }

  // Support either an array of objects or an object map
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'object' && item !== null) {
        const rec = item as Record<string, unknown>;
        const guideId = typeof rec.guideId === 'string' ? rec.guideId : undefined;
        const combinedExcerpt =
          typeof rec.combinedExcerpt === 'string'
            ? rec.combinedExcerpt
            : typeof rec.explainerContext === 'string'
              ? rec.explainerContext
              : typeof rec.excerpt === 'string'
                ? rec.excerpt
                : '';
        if (guideId && combinedExcerpt.trim()) {
          const explainerContextHash =
            typeof rec.explainerContextHash === 'string' && rec.explainerContextHash
              ? rec.explainerContextHash
              : createHash('sha256').update(combinedExcerpt.trim()).digest('hex').slice(0, 12);
          map.set(guideId, { combinedExcerpt: combinedExcerpt.trim(), explainerContextHash });
        }
      }
    }
  } else {
    for (const [guideId, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) {
        const hash = createHash('sha256').update(val.trim()).digest('hex').slice(0, 12);
        map.set(guideId, { combinedExcerpt: val.trim(), explainerContextHash: hash });
      } else if (typeof val === 'object' && val !== null) {
        const rec = val as Record<string, unknown>;
        const combinedExcerpt =
          typeof rec.combinedExcerpt === 'string'
            ? rec.combinedExcerpt
            : typeof rec.explainerContext === 'string'
              ? rec.explainerContext
              : typeof rec.excerpt === 'string'
                ? rec.excerpt
                : '';
        if (combinedExcerpt.trim()) {
          const hash =
            typeof rec.explainerContextHash === 'string' && rec.explainerContextHash
              ? rec.explainerContextHash
              : createHash('sha256').update(combinedExcerpt.trim()).digest('hex').slice(0, 12);
          map.set(guideId, { combinedExcerpt: combinedExcerpt.trim(), explainerContextHash: hash });
        }
      }
    }
  }

  return map;
}

export interface GuideTriageInput {
  readonly guideId: string;
  readonly category: string;
  readonly guideHash: string;
  readonly markdownContent: string;
  readonly explainerContext?: string;
  readonly explainerContextHash?: string;
}

export type Gate0GuideInput = GuideTriageInput;
export type Gate0Input = GuideTriageInput;

export interface GuideTriageOptions {
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly maxRetries?: number;
  readonly model?: string;
  readonly enableSearchGrounding?: boolean;
}

export type Gate0Options = GuideTriageOptions;

export function buildGuideTriageRequestBody(guide: GuideTriageInput, options?: GuideTriageOptions): unknown {
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;
  const guidePromptInput = {
    guideId: guide.guideId,
    category: guide.category,
    markdownContent: guide.markdownContent,
    guideHash: guide.guideHash,
    explainerContext: guide.explainerContext,
  };
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: GATE0_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatGate0Prompt(guidePromptInput) }],
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
export const buildGate0RequestBody = buildGuideTriageRequestBody;

export function parseGuideTriageResponse(
  rawText: string,
  guideId: string,
): {
  classification: Gate0Classification;
  candidateTechniques: string[];
  replaces?: string[];
  doesNotReplace?: string[];
  borderline: boolean;
  brownfieldTarget: string;
  evidenceFromGuide: string;
  reason: string;
  evidenceSource?: Gate0EvidenceSource;
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

  let replaces: string[] | undefined;
  if (Array.isArray(rec.replaces)) {
    replaces = rec.replaces.map((t) => {
      if (typeof t !== 'string') {
        throw new Error(`Gate 0 replaces must be string for guide ${guideId}`);
      }
      return t.trim();
    });
  }

  let doesNotReplace: string[] | undefined;
  if (Array.isArray(rec.doesNotReplace)) {
    doesNotReplace = rec.doesNotReplace.map((t) => {
      if (typeof t !== 'string') {
        throw new Error(`Gate 0 doesNotReplace must be string for guide ${guideId}`);
      }
      return t.trim();
    });
  }

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

  let evidenceSource: Gate0EvidenceSource | undefined;
  if (typeof rec.evidenceSource === 'string') {
    const validSources = ['guide', 'explainer', 'search', 'ecosystem-knowledge', 'none'] as const;
    if (validSources.includes(rec.evidenceSource as Gate0EvidenceSource)) {
      evidenceSource = rec.evidenceSource as Gate0EvidenceSource;
    }
  }

  return {
    classification,
    candidateTechniques,
    ...(replaces ? { replaces } : {}),
    ...(doesNotReplace ? { doesNotReplace } : {}),
    borderline,
    brownfieldTarget,
    evidenceFromGuide: rec.evidenceFromGuide.trim(),
    reason: rec.reason.trim(),
    ...(evidenceSource ? { evidenceSource } : {}),
  };
}
export const parseGate0Response = parseGuideTriageResponse;

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
export const triageGuide = classifyGuideGate0;

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
        groundingChunks?: Array<{
          web?: {
            uri?: string;
            title?: string;
          };
        }>;
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
  const groundingSources: string[] = [];
  if (Array.isArray(candidate?.groundingMetadata?.groundingChunks)) {
    for (const chunk of candidate.groundingMetadata.groundingChunks) {
      const uri = chunk.web?.uri?.trim();
      const title = chunk.web?.title?.trim();
      if (uri) {
        groundingSources.push(uri);
      } else if (title) {
        groundingSources.push(title);
      }
    }
  }

  const parsed = parseGate0Response(text, guide.guideId);
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;

  const explainerContextHash =
    guide.explainerContextHash ??
    (guide.explainerContext?.trim()
      ? createHash('sha256').update(guide.explainerContext.trim()).digest('hex').slice(0, 12)
      : undefined);

  return {
    guideId: guide.guideId,
    guideHash: guide.guideHash,
    classification: parsed.classification,
    candidateTechniques: parsed.candidateTechniques,
    ...(parsed.replaces ? { replaces: parsed.replaces } : {}),
    ...(parsed.doesNotReplace ? { doesNotReplace: parsed.doesNotReplace } : {}),
    borderline: parsed.borderline,
    brownfieldTarget: parsed.brownfieldTarget,
    evidenceFromGuide: parsed.evidenceFromGuide,
    reason: parsed.reason,
    gate0PromptVersion: computeGate0PromptVersion(0.0, enableSearchGrounding),
    ...(parsed.evidenceSource ? { evidenceSource: parsed.evidenceSource } : {}),
    ...(explainerContextHash ? { explainerContextHash } : {}),
    webSearchQueries,
    ...(groundingSources.length > 0 ? { groundingSources } : {}),
  };
}
