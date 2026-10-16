import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import { getGeminiApiKey, loadRawGuideMarkdown } from './judge.ts';

export const PHASE2_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type Phase2Confidence = 'high' | 'medium' | 'low';

export interface Phase2Verdict {
  readonly cardId: string;
  readonly keep: boolean;
  readonly reason: string;
  readonly confidence: Phase2Confidence;
}

export interface Phase2Options {
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly concurrency?: number;
  readonly maxRetries?: number;
  readonly model?: string;
}

export interface Phase2FilterResult {
  readonly results: readonly Phase2Verdict[];
  readonly verdicts: readonly Phase2Verdict[];
  readonly keptFindings: readonly AnalyzerFinding[];
}

export {
  PHASE2_PROMPT_VERSION,
  PHASE2_RESPONSE_SCHEMA,
  PHASE2_SYSTEM_PROMPT,
  PHASE2_THINKING_BUDGET,
  formatPhase2Prompt,
} from './prompts.ts';
import {
  PHASE2_PROMPT_VERSION,
  PHASE2_RESPONSE_SCHEMA,
  PHASE2_SYSTEM_PROMPT,
  PHASE2_THINKING_BUDGET,
  formatPhase2Prompt,
} from './prompts.ts';

export function buildPhase2RequestBody(
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

export function parsePhase2Response(rawText: string, cardId: string): Phase2Verdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (err: unknown) {
    throw new Error(`Phase 2 response JSON parse error for card ${cardId}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Phase 2 invalid response shape for card ${cardId}: expected object`);
  }

  const rec = parsed as Record<string, unknown>;
  if (typeof rec.keep !== 'boolean') {
    throw new Error(`Phase 2 response missing boolean 'keep' property for card ${cardId}`);
  }
  if (typeof rec.reason !== 'string') {
    throw new Error(`Phase 2 response missing string 'reason' property for card ${cardId}`);
  }
  const confidence = rec.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new Error(
      `Phase 2 response invalid confidence '${String(confidence)}' for card ${cardId}`,
    );
  }

  return {
    cardId,
    keep: rec.keep,
    reason: rec.reason,
    confidence,
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
 * Synthetic single-shot LLM simulation of Phase 2 candidate verification.
 *
 * NOTE: This is a synthetic single-shot Gemini API simulation of a verification step,
 * NOT a real autonomous coding agent. It evaluates finding context against the
 * rule's keepWhen/dropWhen rubric in a single shot prompt.
 */
export async function simulateSingleShotPhase2Filter(
  findings: readonly AnalyzerFinding[],
  rulesById: ReadonlyMap<string, AnalyzerRule>,
  options?: Phase2Options,
): Promise<Phase2FilterResult> {
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
  const model = options?.model ?? PHASE2_MODEL;
  const maxRetries = options?.maxRetries ?? 8;
  const concurrency = Math.max(1, options?.concurrency ?? 5);

  const verdicts: Phase2Verdict[] = Array.from({ length: findings.length });

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

      const guideMarkdown = guideMarkdownCache.get(rule.guideId) ?? '';
      const body = buildPhase2RequestBody(finding, rule, guideMarkdown);
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

      verdicts[idx] = parsePhase2Response(text, finding.cardId);
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

export const runPhase2Filter = simulateSingleShotPhase2Filter;
export const phase2Filter = simulateSingleShotPhase2Filter;
