import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';

const WORKTREE_ROOT = resolve(import.meta.dirname, '../..');
const GUIDES_DIR = join(WORKTREE_ROOT, 'guides');

export const LLM_VERIFIER_MODEL = 'gemini-3.8-flash';
export const PROMPT_MODEL = LLM_VERIFIER_MODEL;
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiEndpointOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

/**
 * Resolves the Gemini API base URL (including `/v1beta` path prefix) from options or
 * `GEMINI_API_BASE` / `GOOGLE_GEMINI_BASE_URL` environment variables.
 */
export function resolveGeminiApiBase(options?: { baseUrl?: string }): string {
  const raw = (
    options?.baseUrl ??
    process.env.GEMINI_API_BASE ??
    process.env.GOOGLE_GEMINI_BASE_URL ??
    ''
  ).trim();
  if (!raw) {
    return GEMINI_API_BASE;
  }
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid Gemini API base URL protocol "${parsed.protocol}"; expected http: or https:`,
    );
  }
  const normalized = parsed.toString().replace(/\/+$/, '');
  return /\/v1(?:beta|alpha)?$/.test(normalized) ? normalized : `${normalized}/v1beta`;
}

export const VERIFIER_THINKING_BUDGET = 1024;

/**
 * Computes a deterministic 8-character SHA-256 hash across prompt model, system prompt,
 * user prompt template source, response schema, and thinking budget.
 */
export function computePromptContentHash(params: {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPromptTemplateSource: string;
  readonly schema: unknown;
  readonly thinkingBudget: number;
  readonly temperature?: number;
  readonly enableSearchGrounding?: boolean;
}): string {
  const payload = [
    params.model,
    params.systemPrompt,
    params.userPromptTemplateSource,
    JSON.stringify(params.schema),
    String(params.thinkingBudget),
    String(params.temperature ?? 0.0),
    String(params.enableSearchGrounding ?? false),
  ].join('\n---\n');
  return createHash('sha256').update(payload).digest('hex').slice(0, 8);
}

export const VERIFIER_SYSTEM_PROMPT = `You are an expert static analysis Phase 2 verifier for Modern Web Guidance.
Your task is to verify whether candidate static analysis matches from Phase 1 represent genuine targets for web platform modernization according to the rule's summary, Phase 2 rubric, and the accompanying guide.md, or whether they should be dropped as false positives.

Follow these verification principles:
1. Examine the AST slice and surrounding context carefully alongside the full guide.md markdown.
2. Check against the rule's keepWhen criteria: if the code implements an old workaround or library pattern that should be modernized with standard web platform features taught in guide.md, mark keep = true.
3. Check against the rule's dropWhen criteria: if the match is a false positive (e.g. non-DOM domain such as audio/canvas/gaming when checking DOM, unrelated business logic, or code already protected by modern feature detection guards), mark keep = false.
4. DEFAULT TO KEEP: When unsure, KEEP the finding (keep = true). Only drop (keep = false) when a dropWhen item or the guide's scope in guide.md clearly rules it out.
5. Output concise, objective reasoning explaining why this finding should be kept or dropped.
6. Provide your confidence level ('high', 'medium', or 'low').`;

export const VERIFIER_RESPONSE_SCHEMA = {
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

export const VERIFIER_USER_PROMPT_TEMPLATE = `## Modern Web Guidance Guide (\${rule.guideId})
\`\`\`markdown
\${guideMarkdown}
\`\`\`

## Rule: \${rule.id}
Summary: \${rule.summary}

### Keep When:
\${keepList}

### Drop When:
\${dropList}

## Finding Location
- File: \${finding.file}
- Line: \${finding.line}
- Matcher Message: \${finding.message}

## Code Context (AST Slice)
\`\`\`
\${contextSnippet}
\`\`\``;

export interface VerifierPromptFindingInput {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly contextSlice?: string;
  readonly codeSnippet?: string;
}

export interface VerifierPromptRuleInput {
  readonly id: string;
  readonly guideId?: string;
  readonly summary: string;
  readonly verifierRubric: {
    readonly keepWhen: readonly string[];
    readonly dropWhen: readonly string[];
  };
}

export function formatVerifierPrompt(
  finding: VerifierPromptFindingInput,
  rule: VerifierPromptRuleInput,
  guideMarkdown?: string,
): string {
  const keepList = rule.verifierRubric.keepWhen.map((item) => `- ${item}`).join('\n');
  const dropList = rule.verifierRubric.dropWhen.map((item) => `- ${item}`).join('\n');
  const contextSnippet = (finding.contextSlice || finding.codeSnippet || '').trim();

  if (!guideMarkdown || !guideMarkdown.trim()) {
    throw new Error(
      `formatVerifierPrompt failed: guideMarkdown is required for rule ${rule.id} (guide ${rule.guideId ?? rule.id}). Failing fast per R28/O55a.`,
    );
  }

  const guideSection = `## Modern Web Guidance Guide (${rule.guideId || rule.id})\n\`\`\`markdown\n${guideMarkdown.trim()}\n\`\`\`\n\n`;

  return `${guideSection}## Rule: ${rule.id}
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

export function computeVerifierPromptVersion(): string {
  const hash = computePromptContentHash({
    model: PROMPT_MODEL,
    systemPrompt: VERIFIER_SYSTEM_PROMPT,
    userPromptTemplateSource: formatVerifierPrompt.toString(),
    schema: VERIFIER_RESPONSE_SCHEMA,
    thinkingBudget: VERIFIER_THINKING_BUDGET,
    temperature: 0.0,
    enableSearchGrounding: false,
  });
  return `${PROMPT_MODEL}:phase2-v2-guide-${hash}`;
}

export const VERIFIER_PROMPT_VERSION = computeVerifierPromptVersion();

/**
 * Resolves the Gemini API key from options, environment, or the workspace .env file.
 * When targeting a custom `baseUrl` (such as a local proxy), returns `''` if no key is set
 * rather than throwing.
 */
export function getGeminiApiKey(options?: GeminiEndpointOptions): string {
  if (options?.apiKey !== undefined) {
    return options.apiKey;
  }
  const baseUrl = resolveGeminiApiBase(options);
  if (baseUrl !== GEMINI_API_BASE) {
    return process.env.GEMINI_API_KEY?.trim() ?? '';
  }
  if (!process.env.GEMINI_API_KEY) {
    try {
      process.loadEnvFile?.(join(WORKTREE_ROOT, '.env'));
    } catch {
      /* ignore missing .env */
    }
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not defined in environment, options, or .env file');
  }
  return key;
}

/**
 * Builds the `generateContent` endpoint URL for `model`, appending `?key=` only when an API key is resolved.
 */
export function buildGenerateContentUrl(model: string, options?: GeminiEndpointOptions): string {
  const baseUrl = resolveGeminiApiBase(options);
  const apiKey = getGeminiApiKey(options);
  const endpoint = `${baseUrl}/models/${model}:generateContent`;
  return apiKey ? `${endpoint}?key=${encodeURIComponent(apiKey)}` : endpoint;
}

export async function findGuideMarkdownPath(
  guideId: string,
  guidesRootDir: string = GUIDES_DIR,
): Promise<string> {
  async function search(dir: string): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === guideId) {
          const guideFile = join(fullPath, 'guide.md');
          try {
            await readFile(guideFile, 'utf8');
            return guideFile;
          } catch {
            /* ignore unreadable guide file */
          }
        }
        const found = await search(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  const foundPath = await search(guidesRootDir);
  if (!foundPath) {
    throw new Error(`guide.md for guideId "${guideId}" not found under ${guidesRootDir}`);
  }
  return foundPath;
}

/**
 * Loads the raw markdown string of guide.md deterministically for a given guideId.
 */
export async function loadRawGuideMarkdown(
  guideId: string,
  guidesRootDir: string = GUIDES_DIR,
): Promise<string> {
  const guidePath = await findGuideMarkdownPath(guideId, guidesRootDir);
  return readFile(guidePath, 'utf8');
}

export type VerifierConfidence = 'high' | 'medium' | 'low';

export interface VerifierVerdict {
  readonly cardId: string;
  readonly keep: boolean;
  readonly reason: string;
  readonly confidence: VerifierConfidence;
}

export interface VerifierOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly concurrency?: number;
  readonly maxRetries?: number;
  readonly model?: string;
}

export interface LlmVerifierResult {
  readonly results: readonly VerifierVerdict[];
  readonly verdicts: readonly VerifierVerdict[];
  readonly keptFindings: readonly AnalyzerFinding[];
}

export function buildVerifierRequestBody(
  finding: AnalyzerFinding,
  rule: AnalyzerRule,
  guideMarkdown?: string,
): unknown {
  return {
    systemInstruction: {
      parts: [{ text: VERIFIER_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatVerifierPrompt(finding, rule, guideMarkdown) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: VERIFIER_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: VERIFIER_THINKING_BUDGET },
    },
  };
}

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
        `LLM Verifier error: Rule not found for finding with ruleId='${finding.ruleId}' / guideId='${finding.guideId}' on ${finding.file}:${finding.line}`,
      );
    }
  }

  const customFetch = options?.fetchFn ?? fetch;
  const model = options?.model ?? LLM_VERIFIER_MODEL;
  const url = buildGenerateContentUrl(model, options);
  const maxRetries = options?.maxRetries ?? 8;
  const concurrency = Math.max(1, options?.concurrency ?? 5);

  const verdicts: VerifierVerdict[] = Array.from({ length: findings.length });

  // Pre-load guide markdown for all involved rules 
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
          `LLM Verifier requires loaded guide markdown for rule ${rule.id} (guide ${rule.guideId}). Failing fast.`,
        );
      }
      const body = buildVerifierRequestBody(finding, rule, guideMarkdown);

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
