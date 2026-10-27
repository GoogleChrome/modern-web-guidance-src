import {
  GEMINI_API_BASE,
  computeExplainerContextHash,
  fetchWithRetry,
  getGeminiApiKey,
  loadExplainerContextMap,
  type ExplainerContextEntry,
} from './detection-eval.ts';
import {
  GUIDE_TRIAGE_PROMPT_VERSION,
  GUIDE_TRIAGE_RESPONSE_SCHEMA,
  GUIDE_TRIAGE_SYSTEM_PROMPT,
  GUIDE_TRIAGE_THINKING_BUDGET,
  PROMPT_MODEL,
  computeGuideTriagePromptVersion,
  formatGuideTriagePrompt,
} from './prompts.ts';

export {
  GEMINI_API_BASE,
  GUIDE_TRIAGE_PROMPT_VERSION,
  GUIDE_TRIAGE_RESPONSE_SCHEMA,
  GUIDE_TRIAGE_SYSTEM_PROMPT,
  GUIDE_TRIAGE_THINKING_BUDGET,
  computeGuideTriagePromptVersion,
  formatGuideTriagePrompt,
  loadExplainerContextMap,
  type ExplainerContextEntry,
};

export const GUIDE_TRIAGE_MODEL = PROMPT_MODEL;

/**
 * Guide Triage bucket classifying whether a published feature guide has a statically detectable brownfield target:
 * - `'detectable'`: The guide replaces a concrete, statically identifiable legacy browser API, CSS property/selector workaround, DOM markup pattern, or third-party package in brownfield code.
 * - `'ui-recipe-multi-part'`: The guide teaches a multi-element UI component or architectural recipe (e.g. carousel, tabs, navigation drawer) where legacy implementations vary wildly and lack a single high-precision static code hook.
 * - `'skip-no-old-way'`: The guide introduces a net-new web platform capability (e.g. WebGPU, WebNN, Passkeys, Prompt API) with no direct legacy browser workaround to migrate from.
 */
export type GuideTriageClassification =
  | 'detectable'
  | 'ui-recipe-multi-part'
  | 'skip-no-old-way';

export type GuideTriageEvidenceSource =
  | 'guide'
  | 'explainer'
  | 'search'
  | 'ecosystem-knowledge'
  | 'none';

export interface GuideTriageEntry {
  readonly guideId: string;
  readonly guideHash: string;
  readonly classification: GuideTriageClassification;
  readonly brownfieldTarget: string;
  readonly candidateTechniques?: readonly string[];
  readonly replaces?: readonly string[];
  readonly doesNotReplace?: readonly string[];
  readonly borderline?: boolean;
  readonly evidenceFromGuide?: string;
  readonly reason: string;
  readonly triagePromptVersion?: string;
  readonly gate0PromptVersion?: string;
  readonly evidenceSource?: GuideTriageEvidenceSource;
  readonly explainerContextHash?: string;
  readonly webSearchQueries?: readonly string[];
  readonly groundingSources?: readonly string[];
}

export interface GuideTriageInput {
  readonly guideId: string;
  readonly category: string;
  readonly guideHash: string;
  readonly markdownContent: string;
  readonly explainerContext?: string;
  readonly explainerContextHash?: string;
}

export interface GuideTriageOptions {
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly maxRetries?: number;
  readonly model?: string;
  readonly enableSearchGrounding?: boolean;
}

export function buildGuideTriageRequestBody(guide: GuideTriageInput, options?: GuideTriageOptions): unknown {
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: GUIDE_TRIAGE_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatGuideTriagePrompt(guide) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GUIDE_TRIAGE_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: GUIDE_TRIAGE_THINKING_BUDGET },
    },
  };

  if (enableSearchGrounding) {
    body.tools = [{ googleSearch: {} }];
  }

  return body;
}

const VALID_EVIDENCE_SOURCES: ReadonlySet<GuideTriageEvidenceSource> = new Set([
  'guide',
  'explainer',
  'search',
  'ecosystem-knowledge',
  'none',
]);

export function parseGuideTriageResponse(
  rawText: string,
  guideId: string,
): {
  classification: GuideTriageClassification;
  candidateTechniques: string[];
  replaces?: string[];
  doesNotReplace?: string[];
  borderline: boolean;
  brownfieldTarget: string;
  evidenceFromGuide: string;
  reason: string;
  evidenceSource?: GuideTriageEvidenceSource;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (err: unknown) {
    throw new Error(`Guide Triage response JSON parse error for guide ${guideId}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Guide Triage invalid response shape for guide ${guideId}: expected object`);
  }

  const rec = parsed as Record<string, unknown>;
  const classification = rec.classification;
  if (
    classification !== 'detectable' &&
    classification !== 'ui-recipe-multi-part' &&
    classification !== 'skip-no-old-way'
  ) {
    throw new Error(
      `Guide Triage response invalid classification '${String(classification)}' for guide ${guideId}`,
    );
  }

  if (!Array.isArray(rec.candidateTechniques)) {
    throw new Error(`Guide Triage response missing array 'candidateTechniques' for guide ${guideId}`);
  }

  const toTrimmedStrings = (arr: unknown[], label: string): string[] =>
    arr.map((t) => {
      if (typeof t !== 'string') {
        throw new Error(`Guide Triage ${label} must be string for guide ${guideId}`);
      }
      return t.trim();
    });

  const candidateTechniques = toTrimmedStrings(rec.candidateTechniques, 'candidateTechnique');
  const replaces = Array.isArray(rec.replaces) ? toTrimmedStrings(rec.replaces, 'replaces') : undefined;
  const doesNotReplace = Array.isArray(rec.doesNotReplace)
    ? toTrimmedStrings(rec.doesNotReplace, 'doesNotReplace')
    : undefined;

  if (typeof rec.borderline !== 'boolean') {
    throw new Error(`Guide Triage response missing boolean 'borderline' for guide ${guideId}`);
  }

  if (typeof rec.brownfieldTarget !== 'string' || !rec.brownfieldTarget.trim()) {
    throw new Error(`Guide Triage response missing string 'brownfieldTarget' for guide ${guideId}`);
  }

  if (typeof rec.evidenceFromGuide !== 'string') {
    throw new Error(`Guide Triage response missing string 'evidenceFromGuide' for guide ${guideId}`);
  }

  if (typeof rec.reason !== 'string' || !rec.reason.trim()) {
    throw new Error(`Guide Triage response missing string 'reason' for guide ${guideId}`);
  }

  const evidenceSource =
    typeof rec.evidenceSource === 'string' &&
    VALID_EVIDENCE_SOURCES.has(rec.evidenceSource as GuideTriageEvidenceSource)
      ? (rec.evidenceSource as GuideTriageEvidenceSource)
      : undefined;

  return {
    classification,
    candidateTechniques,
    ...(replaces ? { replaces } : {}),
    ...(doesNotReplace ? { doesNotReplace } : {}),
    borderline: rec.borderline,
    brownfieldTarget: rec.brownfieldTarget.trim(),
    evidenceFromGuide: rec.evidenceFromGuide.trim(),
    reason: rec.reason.trim(),
    ...(evidenceSource ? { evidenceSource } : {}),
  };
}

/**
 * Upfront classification and scoping of a published feature guide via Gemini LLM using full markdown content.
 * Evaluates 1 guide per LLM call and fails loudly on API or schema errors.
 */
export async function triageGuide(
  guide: GuideTriageInput,
  options?: GuideTriageOptions,
): Promise<GuideTriageEntry> {
  const apiKey = getGeminiApiKey(options);
  const customFetch = options?.fetchFn ?? fetch;
  const model = options?.model ?? GUIDE_TRIAGE_MODEL;
  const maxRetries = options?.maxRetries ?? 8;

  const body = buildGuideTriageRequestBody(guide, options);
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
      `Guide Triage failed for ${guide.guideId} with HTTP ${res.status}: ${errText}`,
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
      `Guide Triage returned empty candidate text for guide ${guide.guideId}`,
    );
  }

  const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries ?? [];
  const groundingSources: string[] = [];
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const source = chunk.web?.uri?.trim() || chunk.web?.title?.trim();
    if (source) {
      groundingSources.push(source);
    }
  }

  const parsed = parseGuideTriageResponse(text, guide.guideId);
  const promptVersion = computeGuideTriagePromptVersion(0.0, options?.enableSearchGrounding ?? true);
  const explainerContextHash =
    guide.explainerContextHash ??
    (guide.explainerContext?.trim()
      ? computeExplainerContextHash(guide.explainerContext)
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
    triagePromptVersion: promptVersion,
    gate0PromptVersion: promptVersion,
    ...(parsed.evidenceSource ? { evidenceSource: parsed.evidenceSource } : {}),
    ...(explainerContextHash ? { explainerContextHash } : {}),
    webSearchQueries,
    ...(groundingSources.length > 0 ? { groundingSources } : {}),
  };
}
