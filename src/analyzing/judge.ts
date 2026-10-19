/* oxlint-disable max-lines-per-function, max-depth */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export {
  JUDGE_VERSION,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  formatBlindCardPrompt,
} from './prompts.ts';
import {
  JUDGE_VERSION,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  formatBlindCardPrompt,
} from './prompts.ts';
import { CALIBRATION_DECK_PATH, CARDS_DIR, GRADES_PATH, GUIDES_DIR, M3_SPOTCHECK_DECK_PATH, REPOS_CONFIG_PATH, WORKTREE_ROOT, repoDir, type RepoConfigEntry, ANALYZER_INTERNAL_DIR } from './paths.ts';
import {
  gwetAc1Nominal,
  krippendorffAlphaNominal,
  ppiPlusPlusPrecision,
  sensitivitySpecificity,
  type PpiPlusPlusResult,
  type SensitivitySpecificityResult,
} from './stats.ts';

export const JUDGE_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type JudgeVerdict = 'right' | 'not-old-pattern' | 'leave-it' | 'guide-wrong' | 'unsure';

export const VALID_VERDICTS: ReadonlySet<string> = new Set([
  'right',
  'not-old-pattern',
  'leave-it',
  'guide-wrong',
  'unsure',
]);

export function isJudgeVerdict(value: unknown): value is JudgeVerdict {
  return typeof value === 'string' && VALID_VERDICTS.has(value);
}

export interface DetectiveFactCheck {
  matches_before_syntax: boolean;
  has_fallback_or_feature_guard: boolean;
  modern_feature_applies_here: boolean;
  reasoning: string;
  verdict: JudgeVerdict;
  rawVerdict?: JudgeVerdict;
}

export function isDetectiveFactCheck(obj: unknown): obj is DetectiveFactCheck {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  return (
    'matches_before_syntax' in obj &&
    typeof obj.matches_before_syntax === 'boolean' &&
    'has_fallback_or_feature_guard' in obj &&
    typeof obj.has_fallback_or_feature_guard === 'boolean' &&
    'modern_feature_applies_here' in obj &&
    typeof obj.modern_feature_applies_here === 'boolean' &&
    'reasoning' in obj &&
    typeof obj.reasoning === 'string' &&
    'verdict' in obj &&
    isJudgeVerdict(obj.verdict) &&
    (!('rawVerdict' in obj) || obj.rawVerdict === undefined || isJudgeVerdict(obj.rawVerdict))
  );
}

export interface GuideSummaryInfo {
  guideId: string;
  problem: string;
  before: string;
  now: string;
  markdownBody?: string;
  oldWayExamples?: string[];
  ruleSummary?: string;
  readonly explainerContext?: string;
}

export interface BlindCardPayload {
  cardId: string;
  repo: string;
  commit?: string;
  file: string;
  line: number;
  guideId: string;
  ruleId?: string;
  guideSummary: GuideSummaryInfo;
  codeSnippet: string;
  ruleHash?: string;
  guideHash?: string;
}

export interface JudgeResult {
  cardId: string;
  verdict: JudgeVerdict;
  facts: DetectiveFactCheck;
  rawResponse?: string;
  error?: string;
}

export interface CanaryCard {
  cardId: string;
  expectedVerdict: JudgeVerdict;
  description?: string;
}

export interface CanaryCheckResult {
  passed: boolean;
  tpr: number;
  tnr: number;
  positives: number;
  negatives: number;
  violations: Array<{ cardId: string; expected: JudgeVerdict; actual: JudgeVerdict }>;
}

export interface StabilityEvaluationResult {
  stabilityRate: number | null;
  krippendorffAlpha: number;
  gwetAc1: number;
  pairwiseAlphas: readonly [number, number, number];
  pairwiseAc1s: readonly [number, number, number];
  consensusResults: JudgeResult[];
}

export interface JudgeEvaluationMetrics {
  krippendorffAlpha: number;
  gwetAc1: number;
  sensitivitySpecificity: SensitivitySpecificityResult;
  ppiPrecision: PpiPlusPlusResult;
  retainedDroppedRate: number | null;
  nPaired: number;
  unsureCount?: number;
}

export interface JudgeRunOptions {
  apiKey?: string;
  mode?: 'batch' | 'direct';
  concurrency?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  temperature?: number;
}

/**
 * Helper to construct Gemini generateContent request body with structured schema and thinking budget.
 */
export function buildGeminiRequestBody(card: BlindCardPayload, temperature = 0.2): unknown {
  return {
    systemInstruction: {
      parts: [{ text: JUDGE_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: formatBlindCardPrompt(card) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: JUDGE_RESPONSE_SCHEMA,
      temperature,
      thinkingConfig: { thinkingBudget: JUDGE_THINKING_BUDGET },
    },
  };
}

/**
 * Cross-checks and computes unambiguous judge verdict from the 3 boolean facts per R29 and Spec §2.2:
 * - !matches_before_syntax -> 'not-old-pattern'
 * - matches_before_syntax && has_fallback_or_feature_guard -> 'leave-it'
 * - matches_before_syntax && !has_fallback_or_feature_guard && !modern_feature_applies_here -> 'leave-it'
 * - raw llmVerdict === 'guide-wrong' -> 'guide-wrong'
 * - raw llmVerdict === 'unsure' -> 'unsure'
 * - matches_before_syntax && !has_fallback_or_feature_guard && modern_feature_applies_here -> 'right'
 */
export function deriveJudgeVerdictFromFacts(
  facts: {
    matches_before_syntax: boolean;
    has_fallback_or_feature_guard: boolean;
    modern_feature_applies_here: boolean;
  },
  llmVerdict?: JudgeVerdict,
): JudgeVerdict {
  if (llmVerdict === 'guide-wrong') {
    return 'guide-wrong';
  }
  if (!facts.matches_before_syntax) {
    return 'not-old-pattern';
  }
  if (facts.has_fallback_or_feature_guard) {
    return 'leave-it';
  }
  if (!facts.modern_feature_applies_here) {
    return 'leave-it';
  }
  if (llmVerdict === 'unsure') {
    return 'unsure';
  }
  return 'right';
}

/**
 * Parses Gemini candidate content into DetectiveFactCheck.
 * Fails fast with an explicit Error on invalid JSON or schema violations per Global Rules and R22.
 * Cross-checks and derives unambiguous verdicts from structured facts per R29.
 */
export function parseJudgeJsonContent(rawText: string, cardId: string): JudgeResult {
  const trimmed = rawText.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: unknown) {
    throw new Error(
      `Judge response for card ${cardId} is not valid JSON: ${String(err)}\nRaw response: ${rawText}`,
    );
  }

  if (!isDetectiveFactCheck(parsed)) {
    throw new Error(
      `Judge response for card ${cardId} does not match schema: ${JSON.stringify(parsed)}\nRaw response: ${rawText}`,
    );
  }

  const finalVerdict = deriveJudgeVerdictFromFacts(parsed, parsed.verdict);

  return {
    cardId,
    verdict: finalVerdict,
    facts: {
      ...parsed,
      verdict: finalVerdict,
      rawVerdict: parsed.verdict,
    },
    rawResponse: rawText,
  };
}

interface InlinedGeminiResponseItem {
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  error?: {
    message?: string;
  };
}

interface BatchStatusResponse {
  name: string;
  done?: boolean;
  state?: string;
  metadata?: {
    state?: string;
    output?: {
      inlinedResponses?: {
        inlinedResponses?: InlinedGeminiResponseItem[];
      };
      inlined_responses?: {
        inlined_responses?: InlinedGeminiResponseItem[];
      };
      responsesFile?: string;
      responses_file?: string;
    };
  };
  output?: {
    inlinedResponses?: {
      inlinedResponses?: InlinedGeminiResponseItem[];
    };
    inlined_responses?: {
      inlined_responses?: InlinedGeminiResponseItem[];
    };
    responsesFile?: string;
    responses_file?: string;
  };
  response?: {
    output?: {
      inlinedResponses?: {
        inlinedResponses?: InlinedGeminiResponseItem[];
      };
      inlined_responses?: {
        inlined_responses?: InlinedGeminiResponseItem[];
      };
    };
  };
  error?: {
    message?: string;
    code?: number;
  };
}

/**
 * Resolves the Gemini API key from options, environment, or the workspace .env file.
 */
export function getGeminiApiKey(options?: JudgeRunOptions): string {
  if (options?.apiKey) {
    return options.apiKey;
  }
  if (!process.env.GEMINI_API_KEY) {
    try {
      process.loadEnvFile?.(join(WORKTREE_ROOT, '.env'));
    } catch {
      /* ignore missing .env */
    }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not defined in environment, options, or .env file');
  }
  return key;
}

export async function fetchWithRetry(
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
 * Runs judge evaluation directly via generateContent with concurrency control.
 * Never turns API, network, or rate-limit errors into dummy verdicts: retries with
 * exponential backoff and fails fast with an explicit Error.
 */
export async function runJudgeDirect(
  cards: BlindCardPayload[],
  options: JudgeRunOptions = {},
): Promise<JudgeResult[]> {
  const apiKey = getGeminiApiKey(options);

  const customFetch = options.fetchFn ?? fetch;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const results: JudgeResult[] = Array.from({ length: cards.length });

  let currentIndex = 0;
  async function worker(): Promise<void> {
    while (currentIndex < cards.length) {
      const idx = currentIndex++;
      const card = cards[idx];
      const body = buildGeminiRequestBody(card, options.temperature);
      const url = `${GEMINI_API_BASE}/models/${JUDGE_MODEL}:generateContent?key=${apiKey}`;

      const res = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        customFetch,
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Gemini generateContent failed for card ${card.cardId} with HTTP ${res.status}: ${errText}`,
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      results[idx] = parseJudgeJsonContent(text, card.cardId);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}

interface PollBatchContext {
  batchName: string;
  apiKey: string;
  cards: BlindCardPayload[];
  timeoutMs: number;
  pollIntervalMs: number;
  customFetch: typeof fetch;
}

/**
 * Polls a batch operation until finished or timeout.
 * Throws explicit error on any failure or HTTP non-200.
 */
async function pollBatchUntilDone(ctx: PollBatchContext): Promise<JudgeResult[]> {
  const startTime = Date.now();
  const fields = 'name,done,error,response';
  const pollUrl = `${GEMINI_API_BASE}/${ctx.batchName}?key=${ctx.apiKey}&fields=${encodeURIComponent(fields)}`;

  while (Date.now() - startTime < ctx.timeoutMs) {
    await new Promise((r) => setTimeout(r, ctx.pollIntervalMs));

    let pollRes: Response;
    try {
      pollRes = await ctx.customFetch(pollUrl);
    } catch (err: unknown) {
      throw new Error(`Gemini Batch polling network error: ${String(err)}`);
    }

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(
        `Gemini Batch API polling failed with HTTP ${pollRes.status}: ${errText}`,
      );
    }

    const batchData = (await pollRes.json()) as BatchStatusResponse;
    const state =
      batchData.state ??
      batchData.metadata?.state ??
      (batchData.done ? 'BATCH_STATE_SUCCEEDED' : 'BATCH_STATE_RUNNING');

    if (
      state === 'BATCH_STATE_FAILED' ||
      state === 'BATCH_STATE_CANCELLED' ||
      state === 'BATCH_STATE_EXPIRED'
    ) {
      throw new Error(
        `Gemini Batch failed with state ${state}: ${batchData.error?.message ?? 'No error details'}`,
      );
    }

    if (state === 'BATCH_STATE_SUCCEEDED' || batchData.done) {
      const rawOutput = (batchData.output ??
        batchData.metadata?.output ??
        batchData.response?.output ??
        (batchData as { response?: unknown }).response) as
        | {
            inlinedResponses?: { inlinedResponses?: InlinedGeminiResponseItem[] };
            inlined_responses?: { inlined_responses?: InlinedGeminiResponseItem[] };
          }
        | undefined;

      const inlinedList: InlinedGeminiResponseItem[] | undefined =
        rawOutput?.inlinedResponses?.inlinedResponses ??
        rawOutput?.inlined_responses?.inlined_responses;

      if (inlinedList && inlinedList.length === ctx.cards.length) {
        return inlinedList.map((item: InlinedGeminiResponseItem, idx: number) => {
          const cardId = ctx.cards[idx].cardId;
          const text = item.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          return parseJudgeJsonContent(text, cardId);
        });
      }
      throw new Error(
        `Gemini Batch output missing or response count mismatch (expected ${ctx.cards.length}, got ${inlinedList?.length ?? 0})`,
      );
    }
  }

  throw new Error(`Gemini Batch polling timed out after ${ctx.timeoutMs}ms`);
}

/**
 * Runs judge evaluation using the Gemini Batch API (batchGenerateContent + polling).
 * Never silently falls back to direct execution: fails fast with explicit error on failure.
 * When mode: 'direct' is explicitly passed, executes directly.
 */
export async function runJudgeBatch(
  cards: BlindCardPayload[],
  options: JudgeRunOptions = {},
): Promise<JudgeResult[]> {
  if (cards.length === 0) {
    return [];
  }

  if (options.mode === 'direct') {
    return runJudgeDirect(cards, options);
  }

  const apiKey = getGeminiApiKey(options);
  const customFetch = options.fetchFn ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 180000;

  // Prepare batch requests
  const requests = cards.map((card) => ({
    request: buildGeminiRequestBody(card),
    metadata: { cardId: card.cardId },
  }));

  const batchCreatePayload = {
    batch: {
      displayName: `judge-eval-${Date.now()}`,
      inputConfig: {
        requests: {
          requests,
        },
      },
    },
  };

  const createUrl = `${GEMINI_API_BASE}/models/${JUDGE_MODEL}:batchGenerateContent?key=${apiKey}`;
  const createRes = await customFetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchCreatePayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(
      `Gemini Batch API creation failed with HTTP ${createRes.status}: ${errText}`,
    );
  }

  const createData = (await createRes.json()) as { name?: string };
  const batchName = createData.name;
  if (!batchName) {
    throw new Error('Gemini Batch API creation succeeded but returned no batch name');
  }

  return pollBatchUntilDone({
    batchName,
    apiKey,
    cards,
    timeoutMs,
    pollIntervalMs,
    customFetch,
  });
}

/**
 * Checks canary items with known ground-truth labels against judge results.
 * Verified: ensures judge catches negative controls and confirmed positives.
 */
export function checkCanaries(
  results: ReadonlyArray<JudgeResult> | ReadonlyMap<string, JudgeVerdict>,
  canaries: ReadonlyArray<CanaryCard>,
): CanaryCheckResult {
  const verdictMap = new Map<string, JudgeVerdict>();
  if (Array.isArray(results)) {
    for (const r of results) {
      verdictMap.set(r.cardId, r.verdict);
    }
  } else {
    for (const [k, v] of (results as ReadonlyMap<string, JudgeVerdict>).entries()) {
      verdictMap.set(k, v);
    }
  }

  const pairs: Array<{ humanRight: boolean; judgeRight: boolean }> = [];
  const violations: CanaryCheckResult['violations'] = [];

  for (const canary of canaries) {
    const actual = verdictMap.get(canary.cardId);
    if (!actual) {
      continue;
    }
    const isHumanRight = canary.expectedVerdict === 'right';
    const isJudgeRight = actual === 'right';
    pairs.push({ humanRight: isHumanRight, judgeRight: isJudgeRight });

    if (actual !== canary.expectedVerdict) {
      violations.push({
        cardId: canary.cardId,
        expected: canary.expectedVerdict,
        actual,
      });
    }
  }

  const { tpr, tnr, positives, negatives } = sensitivitySpecificity(pairs);
  // Canary pass rule: all negative controls (false positives) must be rejected (TNR = 1.0)
  const passed = tnr >= 1.0 && violations.filter((v) => v.expected !== 'right').length === 0;

  return {
    passed,
    tpr,
    tnr,
    positives,
    negatives,
    violations,
  };
}

/**
 * Evaluates 3-run judge stability and derives consensus majority verdicts.
 */
export function evaluateJudgeStability(
  runs: readonly [
    ReadonlyArray<JudgeResult>,
    ReadonlyArray<JudgeResult>,
    ReadonlyArray<JudgeResult>,
  ],
): StabilityEvaluationResult {
  const [run0, run1, run2] = runs;
  const n = run0.length;
  if (run1.length !== n || run2.length !== n) {
    throw new Error('All 3 stability runs must contain identical number of cards');
  }

  const pairs01: Array<readonly [string, string]> = [];
  const pairs12: Array<readonly [string, string]> = [];
  const pairs02: Array<readonly [string, string]> = [];

  let exactMatchCount = 0;
  const consensusResults: JudgeResult[] = [];

  for (let i = 0; i < n; i++) {
    const v0 = run0[i].verdict;
    const v1 = run1[i].verdict;
    const v2 = run2[i].verdict;

    pairs01.push([v0, v1]);
    pairs12.push([v1, v2]);
    pairs02.push([v0, v2]);

    if (v0 === v1 && v1 === v2) {
      exactMatchCount++;
    }

    // Determine majority verdict
    let consensusVerdict: JudgeVerdict;
    let chosenFacts = run0[i].facts;

    if (v0 === v1 || v0 === v2) {
      consensusVerdict = v0;
      chosenFacts = run0[i].facts;
    } else if (v1 === v2) {
      consensusVerdict = v1;
      chosenFacts = run1[i].facts;
    } else {
      consensusVerdict = 'unsure';
    }

    consensusResults.push({
      cardId: run0[i].cardId,
      verdict: consensusVerdict,
      facts: chosenFacts,
    });
  }

  const alpha01 = krippendorffAlphaNominal(pairs01);
  const alpha12 = krippendorffAlphaNominal(pairs12);
  const alpha02 = krippendorffAlphaNominal(pairs02);
  const avgAlpha = (alpha01 + alpha12 + alpha02) / 3;

  const ac101 = gwetAc1Nominal(pairs01);
  const ac112 = gwetAc1Nominal(pairs12);
  const ac102 = gwetAc1Nominal(pairs02);
  const avgAc1 = (ac101 + ac112 + ac102) / 3;

  return {
    stabilityRate: n > 0 ? exactMatchCount / n : null,
    krippendorffAlpha: avgAlpha,
    gwetAc1: avgAc1,
    pairwiseAlphas: [alpha01, alpha12, alpha02],
    pairwiseAc1s: [ac101, ac112, ac102],
    consensusResults,
  };
}

/**
 * Computes all admission guard metrics between judge results and reference human labels.
 */
export function evaluateJudgeMetrics(
  judgeResults: ReadonlyArray<JudgeResult>,
  humanGrades: ReadonlyMap<string, string>,
  droppedCardIds: ReadonlySet<string> = new Set(),
): JudgeEvaluationMetrics {
  const nominalPairs: Array<readonly [string, string]> = [];
  const binaryPairs: Array<{ humanRight: boolean; judgeRight: boolean }> = [];
  const judgeAllBools: boolean[] = judgeResults.map((j) => j.verdict === 'right');

  let retainedDroppedCount = 0;
  let totalDroppedEvaluated = 0;
  let unsureCount = 0;

  for (const j of judgeResults) {
    const humanLabel = humanGrades.get(j.cardId);
    if (humanLabel) {
      nominalPairs.push([humanLabel, j.verdict]);
      if (humanLabel === 'unsure') {
        unsureCount++;
      } else {
        binaryPairs.push({
          humanRight: humanLabel === 'right',
          judgeRight: j.verdict === 'right',
        });
      }
    }

    if (droppedCardIds.has(j.cardId)) {
      totalDroppedEvaluated++;
      if (j.verdict !== 'right') {
        retainedDroppedCount++;
      }
    }
  }

  const alpha = krippendorffAlphaNominal(nominalPairs);
  const ac1 = gwetAc1Nominal(nominalPairs);
  const sensSpec = sensitivitySpecificity(binaryPairs);
  const ppiPrecision = ppiPlusPlusPrecision(judgeAllBools, binaryPairs);

  const retainedDroppedRate =
    totalDroppedEvaluated > 0 ? retainedDroppedCount / totalDroppedEvaluated : null;

  return {
    krippendorffAlpha: alpha,
    gwetAc1: ac1,
    sensitivitySpecificity: sensSpec,
    ppiPrecision,
    retainedDroppedRate,
    nPaired: nominalPairs.length,
    unsureCount,
  };
}

/**
 * Loads human grades from the canonical grades file into a Map.
 */
export async function loadHumanGrades(
  gradesFilePath: string = GRADES_PATH,
): Promise<Map<string, string>> {
  const content = await readFile(gradesFilePath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  const map = new Map<string, string>();

  for (const line of lines) {
    const parsed = JSON.parse(line) as { cardId: string; verdict: string };
    if (parsed.cardId && parsed.verdict) {
      map.set(parsed.cardId, parsed.verdict);
    }
  }

  return map;
}

/**
 * Deterministically locates the guide.md file for a given guideId under guidesRootDir.
 */
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

/**
 * Parses raw guide.md text into a GuideSummaryInfo directly from frontmatter and markdown sections.
 * Zero hand-tuned examples, zero card-fitting.
 */
export function parseGuideSummaryMarkdown(
  markdown: string,
  guideId: string,
): GuideSummaryInfo {
  // 1. Extract frontmatter
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const fmDescription = descMatch ? descMatch[1].trim() : '';

  // 2. Remove frontmatter and extract title
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : guideId;
  const bodyWithoutTitle = body.replace(/^#\s+[^\n]+\n*/, '').trim();

  // 3. Split into sections by Markdown headers (## or ###)
  const lines = bodyWithoutTitle.split('\n');
  const sections: Array<{ header: string; content: string }> = [];
  let currentHeader = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const hMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (hMatch) {
      if (currentLines.length > 0 || currentHeader !== 'Introduction') {
        sections.push({ header: currentHeader, content: currentLines.join('\n').trim() });
      }
      currentHeader = hMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({ header: currentHeader, content: currentLines.join('\n').trim() });
  }

  const introSection = sections.find((s) => s.header === 'Introduction')?.content ?? sections[0]?.content ?? '';

  let problem = '';
  let before = '';
  let now = '';

  for (const s of sections) {
    const h = s.header.toLowerCase();
    if (h.includes('problem') && !problem) {
      problem = s.content;
    }
    if ((h === 'before' || h.includes('legacy pattern') || h.startsWith('before')) && !before) {
      before = s.content;
    }
    if (
      (h === 'now' ||
        h.includes('modern replacement') ||
        h.startsWith('now') ||
        h.includes('the solution')) &&
      !now
    ) {
      now = s.content;
    }
  }

  if (!problem) {
    problem = fmDescription || introSection.split('\n\n')[0] || title;
  }

  if (!before || !now) {
    const overviewSection = sections.find((s) => s.header.toLowerCase().includes('overview'));
    const sourceText = `${introSection}\n${overviewSection ? overviewSection.content : ''}`.trim();
    const sentences = sourceText.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);

    const beforeParts: string[] = [];
    const nowParts: string[] = [];

    for (const sent of sentences) {
      if (
        /\b(past|historically|previously|traditionally|legacy|prior to|older|earlier)\b/i.test(sent)
      ) {
        beforeParts.push(sent);
      } else {
        nowParts.push(sent);
      }
    }

    if (!before) {
      if (beforeParts.length > 0) {
        before = beforeParts.join(' ');
      } else {
        before = `Legacy approach prior to ${title}: ${problem}`;
      }
    }

    if (!now) {
      if (nowParts.length > 0) {
        now = nowParts.join(' ');
      } else {
        const implSection = sections.find((s) => {
          const h = s.header.toLowerCase();
          return h.includes('implement') || h.includes('usage') || h.includes('solution');
        });
        if (implSection) {
          now = `${title}: ${implSection.content.slice(0, 300)}...`;
        } else {
          now = `Use modern web platform standards for ${title}.`;
        }
      }
    }
  }

  const clean = (str: string): string =>
    str.replace(/\{\{[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim();

  // Verbatim markdown body (frontmatter stripped, up to ~6,000 chars) preserving
  // all explanations, avoid/prefer headings, and code examples.
  const cleanBody = clean(body);
  const maxBodyLength = 6000;
  const markdownBody =
    cleanBody.length > maxBodyLength
      ? cleanBody.slice(0, maxBodyLength) + '\n\n... (guide content truncated)'
      : cleanBody;

  const cleanedProblem = clean(problem);
  const cleanedBefore = clean(before);
  const cleanedNow = clean(now);
  const finalMarkdownBody = markdownBody.trim().length > 0 ? markdownBody : undefined;

  return {
    guideId,
    problem: cleanedProblem,
    before: cleanedBefore,
    now: cleanedNow,
    markdownBody: finalMarkdownBody,
  };
}

/**
 * Loads a guide summary deterministically from guide.md.
 */
export async function loadGuideSummaryFromMarkdown(
  guideId: string,
  guidesRootDir: string = GUIDES_DIR,
): Promise<GuideSummaryInfo> {
  const guidePath = await findGuideMarkdownPath(guideId, guidesRootDir);
  const content = await readFile(guidePath, 'utf8');
  return parseGuideSummaryMarkdown(content, guideId);
}

/**
 * Loads guide summaries directly from markdown files into a map indexed by guideId.
 */
export async function loadGuideSummariesMap(
  guidesRootDirOrFile: string = GUIDES_DIR,
): Promise<Map<string, GuideSummaryInfo>> {
  const map = new Map<string, GuideSummaryInfo>();

  if (guidesRootDirOrFile.endsWith('.json')) {
    try {
      const content = await readFile(guidesRootDirOrFile, 'utf8');
      const list = JSON.parse(content) as GuideSummaryInfo[];
      for (const item of list) {
        map.set(item.guideId, item);
      }
    } catch {
      /* ignore invalid JSON */
      return map;
    }
  } else {
    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          const guidePath = join(fullPath, 'guide.md');
          try {
            const content = await readFile(guidePath, 'utf8');
            const summary = parseGuideSummaryMarkdown(content, entry.name);
            map.set(entry.name, summary);
          } catch {
            /* ignore unreadable guide */
          }
          await walk(fullPath);
        }
      }
    }

    await walk(guidesRootDirOrFile);
  }

  // Check if explainers JSON exists on disk, and if so, populate explainerContext on each guide
  const explainersJsonPath = join(
    ANALYZER_INTERNAL_DIR,
    'findings',
    '2026-10-19-guide-explainers-171.json',
  );
  try {
    const explainersContent = await readFile(explainersJsonPath, 'utf8');
    const parsed = JSON.parse(explainersContent) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'object' && item !== null) {
          const rec = item as Record<string, unknown>;
          const guideId = typeof rec.guideId === 'string' ? rec.guideId : undefined;
          const excerpt =
            typeof rec.combinedExcerpt === 'string'
              ? rec.combinedExcerpt
              : typeof rec.explainerContext === 'string'
                ? rec.explainerContext
                : typeof rec.excerpt === 'string'
                  ? rec.excerpt
                  : '';
          if (guideId && excerpt.trim()) {
            const existing = map.get(guideId);
            if (existing) {
              map.set(guideId, { ...existing, explainerContext: excerpt.trim() });
            }
          }
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      for (const [guideId, val] of Object.entries(parsed as Record<string, unknown>)) {
        let excerpt = '';
        if (typeof val === 'string') {
          excerpt = val.trim();
        } else if (typeof val === 'object' && val !== null) {
          const rec = val as Record<string, unknown>;
          excerpt =
            typeof rec.combinedExcerpt === 'string'
              ? rec.combinedExcerpt.trim()
              : typeof rec.explainerContext === 'string'
                ? rec.explainerContext.trim()
                : typeof rec.excerpt === 'string'
                  ? rec.excerpt.trim()
                  : '';
        }
        if (excerpt) {
          const existing = map.get(guideId);
          if (existing) {
            map.set(guideId, { ...existing, explainerContext: excerpt });
          }
        }
      }
    }
  } catch {
    /* ignore missing or unreadable explainers file */
  }

  return map;
}

export interface PaulIrishGradesResult {
  cards: CalibrationDeckItem[];
  humanVerdicts: Map<string, JudgeVerdict>;
}

/**
 * Loads Paul's canonical human-graded cards from grades.paulirish.jsonl and cards directory.
 * Returns only the scored cards (excluding 'unsure').
 */
export async function loadPaulIrishScoredCards(
  gradesPath: string = GRADES_PATH,
  cardsDir: string = CARDS_DIR,
): Promise<PaulIrishGradesResult> {
  const content = await readFile(gradesPath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  const latestGrades = new Map<string, JudgeVerdict>();

  for (const line of lines) {
    const parsed = JSON.parse(line) as { cardId: string; verdict: string };
    if (parsed.cardId && isJudgeVerdict(parsed.verdict)) {
      latestGrades.set(parsed.cardId, parsed.verdict);
    }
  }

  const allCardsMap = new Map<string, CalibrationDeckItem>();

  async function ingestJsonFile(filePath: string): Promise<void> {
    try {
      const cardContent = await readFile(filePath, 'utf8');
      const rawJson = JSON.parse(cardContent);
      const cardList: CalibrationDeckItem[] = Array.isArray(rawJson)
        ? rawJson
        : rawJson && typeof rawJson === 'object'
          ? [rawJson]
          : [];
      for (const c of cardList) {
        if (c && typeof c === 'object' && c.cardId) {
          allCardsMap.set(c.cardId, c);
        }
      }
    } catch {
      /* ignore unreadable or invalid json */
    }
  }

  // Load known deck paths if they exist
  await ingestJsonFile(CALIBRATION_DECK_PATH);
  await ingestJsonFile(M3_SPOTCHECK_DECK_PATH);
  await ingestJsonFile(join(cardsDir, '_calibration-deck.json'));
  await ingestJsonFile(join(cardsDir, '_m3-spotcheck-deck.json'));

  async function scanDirectory(dir: string, maxDepth = 3): Promise<void> {
    if (maxDepth < 0) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, maxDepth - 1);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          await ingestJsonFile(fullPath);
        }
      }
    } catch {
      /* ignore unreadable dir */
    }
  }

  await scanDirectory(cardsDir);
  await scanDirectory(dirname(cardsDir), 1);

  const scoredCards: CalibrationDeckItem[] = [];
  const scoredVerdicts = new Map<string, JudgeVerdict>();

  for (const [cardId, verdict] of latestGrades.entries()) {
    if (verdict === 'unsure') {
      continue;
    }
    const card = allCardsMap.get(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} in ${gradesPath} not found in ${cardsDir}`);
    }
    // Skip cards whose guide is a stub or non-landed guide (copy-button, dialog, css-layout)
    if (card.guideId === 'copy-button' || card.guideId === 'dialog' || card.guideId === 'css-layout') {
      continue;
    }
    scoredCards.push(card);
    scoredVerdicts.set(cardId, verdict);
  }

  return { cards: scoredCards, humanVerdicts: scoredVerdicts };
}

export interface CalibrationDeckFinding {
  tool: string;
  repo: string;
  commit: string;
  guideId: string;
  sourceId: string;
  kind: string;
  file: string;
  line: number;
  reason: string;
}

export interface CalibrationDeckItem {
  cardId: string;
  repo: string;
  commit: string;
  guideId: string;
  sourceId: string;
  file: string;
  line: number;
  code?: string;
  phase2Decision?: string;
  phase2Reason?: string | null;
  phase2Confidence?: string;
  populationCounts?: { low: number; medium: number; high: number; unknown: number };
  findings?: readonly CalibrationDeckFinding[];
}

/**
 * Loads calibration deck from JSON file.
 */
export async function loadCalibrationDeck(
  deckFilePath: string = CALIBRATION_DECK_PATH,
): Promise<CalibrationDeckItem[]> {
  const content = await readFile(deckFilePath, 'utf8');
  return JSON.parse(content) as CalibrationDeckItem[];
}

/**
 * Slices out code snippet around a line from file content.
 */
export function extractCodeSnippet(fileContent: string, targetLine: number, radius = 15): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, targetLine - 1 - radius);
  const end = Math.min(lines.length, targetLine + radius);

  return lines
    .slice(start, end)
    .map((l, idx) => {
      const lineNum = start + idx + 1;
      const marker = lineNum === targetLine ? '> ' : '  ';
      return `${marker}${String(lineNum).padStart(4, ' ')} | ${l}`;
    })
    .join('\n');
}

/**
 * Prepares BlindCardPayloads from calibration deck and checked out repos.
 */
export async function prepareBlindCards(
  items: ReadonlyArray<CalibrationDeckItem>,
  guideSummaries: ReadonlyMap<string, GuideSummaryInfo>,
  reposConfigPath: string = REPOS_CONFIG_PATH,
): Promise<BlindCardPayload[]> {
  const reposContent = await readFile(reposConfigPath, 'utf8');
  const repoEntries = JSON.parse(reposContent) as RepoConfigEntry[];
  const repoMap = new Map(repoEntries.map((r) => [r.repo, r]));

  const blindCards: BlindCardPayload[] = [];

  for (const item of items) {
    const summary = guideSummaries.get(item.guideId);
    if (!summary?.markdownBody?.trim()) {
      continue;
    }

    let snippet = item.code ?? '';
    if (!snippet) {
      const repoEntry = repoMap.get(item.repo);
      if (repoEntry) {
        const rDir = repoDir(repoEntry);
        const fullPath = join(rDir, item.file);
        try {
          const content = await readFile(fullPath, 'utf8');
          snippet = extractCodeSnippet(content, item.line);
        } catch {
          snippet = `// Unable to read file at ${item.file}:${item.line}`;
        }
      }
    }

    blindCards.push({
      cardId: item.cardId,
      repo: item.repo,
      file: item.file,
      line: item.line,
      guideId: item.guideId,
      guideSummary: summary,
      codeSnippet: snippet,
    });
  }

  return blindCards;
}
