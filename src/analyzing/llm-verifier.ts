import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import { getGeminiApiKey, loadRawGuideMarkdown } from './detection-eval.ts';

export const LLM_VERIFIER_MODEL = 'gemini-3.8-flash';
export const PHASE2_MODEL = LLM_VERIFIER_MODEL;
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type VerifierConfidence = 'high' | 'medium' | 'low';
export type Phase2Confidence = VerifierConfidence;

export interface VerifierVerdict {
  readonly cardId: string;
  readonly keep: boolean;
  readonly reason: string;
  readonly confidence: VerifierConfidence;
}
export type Phase2Verdict = VerifierVerdict;

export interface VerifierOptions {
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly concurrency?: number;
  readonly maxRetries?: number;
  readonly model?: string;
}
export type Phase2Options = VerifierOptions;

export interface LlmVerifierResult {
  readonly results: readonly VerifierVerdict[];
  readonly verdicts: readonly VerifierVerdict[];
  readonly keptFindings: readonly AnalyzerFinding[];
}
export type Phase2FilterResult = LlmVerifierResult;

export {
  PHASE2_PROMPT_VERSION,
  PHASE2_RESPONSE_SCHEMA,
  PHASE2_SYSTEM_PROMPT,
  PHASE2_THINKING_BUDGET,
  formatPhase2Prompt,
  VERIFIER_PROMPT_VERSION,
  VERIFIER_RESPONSE_SCHEMA,
  VERIFIER_SYSTEM_PROMPT,
  VERIFIER_THINKING_BUDGET,
  formatVerifierPrompt,
  buildVerifierPrompt,
  buildPhase2Prompt,
} from './prompts.ts';
import {
  PHASE2_RESPONSE_SCHEMA,
  PHASE2_SYSTEM_PROMPT,
  PHASE2_THINKING_BUDGET,
  formatPhase2Prompt,
} from './prompts.ts';

export function buildVerifierRequestBody(
  finding: AnalyzerFinding,
  rule: AnalyzerRule,
  guideMarkdown?: string,
): unknown {
  return {
    systemInstruction: {
      parts: [{ text: PHASE2_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatPhase2Prompt(finding, rule, guideMarkdown) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PHASE2_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: PHASE2_THINKING_BUDGET },
    },
  };
}
export const buildPhase2RequestBody = buildVerifierRequestBody;

export function parseVerifierResponse(rawText: string, cardId: string): VerifierVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (err: unknown) {
    throw new Error(`Verifier response JSON parse error for card ${cardId}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Verifier invalid response shape for card ${cardId}: expected object`);
  }

  const rec = parsed as Record<string, unknown>;
  if (typeof rec.keep !== 'boolean') {
    throw new Error(`Verifier response missing boolean 'keep' property for card ${cardId}`);
  }
  if (typeof rec.reason !== 'string') {
    throw new Error(`Verifier response missing string 'reason' property for card ${cardId}`);
  }
  const confidence = rec.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new Error(
      `Verifier response invalid confidence '${String(confidence)}' for card ${cardId}`,
    );
  }

  return {
    cardId,
    keep: rec.keep,
    reason: rec.reason,
    confidence,
  };
}
export const parsePhase2Response = parseVerifierResponse;

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
 * Runtime LLM filter (`gemini-3.8-flash`) that evaluates a candidate finding against the
 * rule's `verifierRubric` (`keepWhen` / `dropWhen`) and canonical `guide.md` in a single shot prompt.
 *
 * Emits keep vs drop verdicts and filtered findings before presenting modernization opportunities.
 */
export async function runLlmVerifier(
  findings: readonly AnalyzerFinding[],
  rulesById: ReadonlyMap<string, AnalyzerRule>,
  options?: VerifierOptions,
): Promise<LlmVerifierResult> {
  if (findings.length === 0) {
    return {
      results: [],
      verdicts: [],
      keptFindings: [],
    };
  }

  // Pre-validate that all findings have corresponding rules before initiating network requests
  for (const finding of findings) {
    const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
    if (!rule) {
      throw new Error(
        `Phase 2 error: Rule not found for finding with ruleId='${finding.ruleId}' / guideId='${finding.guideId}' on ${finding.file}:${finding.line}`,
      );
    }
  }

  const apiKey = getGeminiApiKey(options);
  const customFetch = options?.fetchFn ?? fetch;
  const model = options?.model ?? LLM_VERIFIER_MODEL;
  const maxRetries = options?.maxRetries ?? 8;
  const concurrency = Math.max(1, options?.concurrency ?? 5);

  const verdicts: VerifierVerdict[] = Array.from({ length: findings.length });

  // Pre-load guide markdown for all involved rules per R28
  const guideMarkdownCache = new Map<string, string>();
  for (const finding of findings) {
    const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
    if (rule && !guideMarkdownCache.has(rule.guideId)) {
      const md = await loadRawGuideMarkdown(rule.guideId);
      guideMarkdownCache.set(rule.guideId, md);
    }
  }

  let currentIndex = 0;
  async function worker(): Promise<void> {
    while (currentIndex < findings.length) {
      const idx = currentIndex++;
      const finding = findings[idx];
      const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
      if (!rule) {
        verdicts[idx] = {
          cardId: finding.cardId,
          keep: false,
          reason: `No rule found for ${finding.ruleId || finding.guideId}`,
          confidence: 'high',
        };
        continue;
      }

      const guideMarkdown = guideMarkdownCache.get(rule.guideId);
      if (!guideMarkdown || !guideMarkdown.trim()) {
        throw new Error(
          `Phase 2 verifier requires loaded guide markdown for rule ${rule.id} (guide ${rule.guideId}). Failing fast per R28/O55a.`,
        );
      }
      const body = buildVerifierRequestBody(finding, rule, guideMarkdown);
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
          `Gemini generateContent failed for card ${finding.cardId} with HTTP ${res.status}: ${errText}`,
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(
          `Gemini generateContent returned empty candidate text for card ${finding.cardId}`,
        );
      }

      verdicts[idx] = parseVerifierResponse(text, finding.cardId);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const keptFindings = findings.filter((_, idx) => verdicts[idx].keep);

  return {
    results: verdicts,
    verdicts,
    keptFindings,
  };
}

export const simulateSingleShotPhase2Filter = runLlmVerifier;
export const simulateSingleShotVerifier = runLlmVerifier;
export const runPhase2Filter = runLlmVerifier;
