import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import { getGeminiApiKey } from './judge.ts';

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

export const PHASE2_SYSTEM_PROMPT = `You are an expert static analysis Phase 2 verifier for Modern Web Guidance.
Your task is to verify whether candidate static analysis matches from Phase 1 represent genuine targets for web platform modernization according to the rule's summary and Phase 2 rubric, or whether they should be dropped as false positives.

Follow these verification principles:
1. Examine the AST slice and surrounding context carefully.
2. Check against the rule's keepWhen criteria: if the code implements an old workaround or library pattern that should be modernized with standard web platform features, mark keep = true.
3. Check against the rule's dropWhen criteria: if the match is a false positive (e.g. non-DOM domain such as audio/canvas/gaming when checking DOM, unrelated business logic, or code already protected by modern feature detection guards), mark keep = false.
4. Output concise, objective reasoning explaining why this finding should be kept or dropped.
5. Provide your confidence level ('high', 'medium', or 'low').`;

export const PHASE2_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    keep: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
    confidence: {
      type: 'STRING',
      enum: ['high', 'medium', 'low'],
    },
  },
  required: ['keep', 'reason', 'confidence'],
};

export function formatPhase2Prompt(finding: AnalyzerFinding, rule: AnalyzerRule): string {
  const keepList = rule.phase2Rubric.keepWhen.map((item) => `- ${item}`).join('\n');
  const dropList = rule.phase2Rubric.dropWhen.map((item) => `- ${item}`).join('\n');
  const contextSnippet = (finding.astSlice || finding.codeSnippet || '').trim();

  return `## Rule: ${rule.id}
Summary: ${rule.summary}

### Keep When:
${keepList}

### Drop When:
${dropList}

## Finding Location
- File: ${finding.file}
- Line: ${finding.line}
- Matcher Message: ${finding.message}

## Code Context (AST Slice)
\`\`\`
${contextSnippet}
\`\`\``;
}

export function buildPhase2RequestBody(finding: AnalyzerFinding, rule: AnalyzerRule): unknown {
  return {
    systemInstruction: {
      parts: [{ text: PHASE2_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatPhase2Prompt(finding, rule) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PHASE2_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: 0 },
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

export async function runPhase2Filter(
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

      const body = buildPhase2RequestBody(finding, rule);
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

export const phase2Filter = runPhase2Filter;
