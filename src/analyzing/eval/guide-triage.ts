import {
  GEMINI_API_BASE,
  buildGenerateContentUrl,
  computeExplainerContextHash,
  fetchWithRetry,
  loadExplainerContextMap,
  resolveGeminiApiBase,
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
  buildGenerateContentUrl,
  computeGuideTriagePromptVersion,
  formatGuideTriagePrompt,
  loadExplainerContextMap,
  resolveGeminiApiBase,
  type ExplainerContextEntry,
};

export const GUIDE_TRIAGE_MODEL = PROMPT_MODEL;

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
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly maxRetries?: number;
  readonly model?: string;
  readonly enableSearchGrounding?: boolean;
}

export function buildGuideTriageRequestBody(
  guide: GuideTriageInput,
  options?: GuideTriageOptions,
): unknown {
  const enableSearchGrounding = options?.enableSearchGrounding ?? true;
  return {
    systemInstruction: { parts: [{ text: GUIDE_TRIAGE_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: formatGuideTriagePrompt(guide) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GUIDE_TRIAGE_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: GUIDE_TRIAGE_THINKING_BUDGET },
    },
    ...(enableSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
  };
}

const VALID_CLASSIFICATIONS: ReadonlySet<string> = new Set<GuideTriageClassification>([
  'detectable',
  'ui-recipe-multi-part',
  'skip-no-old-way',
]);

const VALID_EVIDENCE_SOURCES: ReadonlySet<string> = new Set<GuideTriageEvidenceSource>([
  'guide',
  'explainer',
  'search',
  'ecosystem-knowledge',
  'none',
]);

export function parseGuideTriageResponse(rawText: string, guideId: string) {
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
  if (typeof rec.classification !== 'string' || !VALID_CLASSIFICATIONS.has(rec.classification)) {
    throw new Error(
      `Guide Triage response invalid classification '${String(rec.classification)}' for guide ${guideId}`,
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

  const requireString = (val: unknown, field: string, nonEmpty = true): string => {
    if (typeof val !== 'string' || (nonEmpty && !val.trim())) {
      throw new Error(`Guide Triage response missing string '${field}' for guide ${guideId}`);
    }
    return val.trim();
  };

  if (typeof rec.borderline !== 'boolean') {
    throw new Error(`Guide Triage response missing boolean 'borderline' for guide ${guideId}`);
  }

  const replaces = Array.isArray(rec.replaces) ? toTrimmedStrings(rec.replaces, 'replaces') : undefined;
  const doesNotReplace = Array.isArray(rec.doesNotReplace)
    ? toTrimmedStrings(rec.doesNotReplace, 'doesNotReplace')
    : undefined;
  const evidenceSource =
    typeof rec.evidenceSource === 'string' && VALID_EVIDENCE_SOURCES.has(rec.evidenceSource)
      ? (rec.evidenceSource as GuideTriageEvidenceSource)
      : undefined;

  return {
    classification: rec.classification as GuideTriageClassification,
    candidateTechniques: toTrimmedStrings(rec.candidateTechniques, 'candidateTechnique'),
    ...(replaces ? { replaces } : {}),
    ...(doesNotReplace ? { doesNotReplace } : {}),
    borderline: rec.borderline,
    brownfieldTarget: requireString(rec.brownfieldTarget, 'brownfieldTarget'),
    evidenceFromGuide: requireString(rec.evidenceFromGuide, 'evidenceFromGuide', false),
    reason: requireString(rec.reason, 'reason'),
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
  const customFetch = options?.fetchFn ?? fetch;
  const model = options?.model ?? GUIDE_TRIAGE_MODEL;
  const maxRetries = options?.maxRetries ?? 8;

  const res = await fetchWithRetry(
    buildGenerateContentUrl(model, options),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGuideTriageRequestBody(guide, options)),
    },
    customFetch,
    maxRetries,
  );

  if (!res.ok) {
    throw new Error(
      `Guide Triage failed for ${guide.guideId} with HTTP ${res.status}: ${await res.text()}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        webSearchQueries?: string[];
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Guide Triage returned empty candidate text for guide ${guide.guideId}`);
  }

  const groundingSources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => chunk.web?.uri?.trim() || chunk.web?.title?.trim() || '')
    .filter(Boolean);

  const parsed = parseGuideTriageResponse(text, guide.guideId);
  const promptVersion = computeGuideTriagePromptVersion(0.0, options?.enableSearchGrounding ?? true);
  const explainerContextHash =
    guide.explainerContextHash ??
    (guide.explainerContext?.trim() ? computeExplainerContextHash(guide.explainerContext) : undefined);

  return {
    guideId: guide.guideId,
    guideHash: guide.guideHash,
    ...parsed,
    triagePromptVersion: promptVersion,
    gate0PromptVersion: promptVersion,
    ...(explainerContextHash ? { explainerContextHash } : {}),
    webSearchQueries: candidate?.groundingMetadata?.webSearchQueries ?? [],
    ...(groundingSources.length > 0 ? { groundingSources } : {}),
  };
}
