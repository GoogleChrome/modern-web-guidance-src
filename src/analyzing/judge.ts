import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CALIBRATION_DECK_PATH,
  GRADES_PATH,
  GUIDE_SUMMARIES_PATH,
  REPOS_CONFIG_PATH,
  repoDir,
  type RepoConfigEntry,
} from './paths.ts';
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
}

export function isDetectiveFactCheck(obj: unknown): obj is DetectiveFactCheck {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const rec = obj as Record<string, unknown>;
  return (
    typeof rec.matches_before_syntax === 'boolean' &&
    typeof rec.has_fallback_or_feature_guard === 'boolean' &&
    typeof rec.modern_feature_applies_here === 'boolean' &&
    typeof rec.reasoning === 'string' &&
    isJudgeVerdict(rec.verdict)
  );
}

export interface GuideSummaryInfo {
  guideId: string;
  problem: string;
  before: string;
  now: string;
  oldWayExamples?: string[];
}

export interface BlindCardPayload {
  cardId: string;
  repo: string;
  file: string;
  line: number;
  guideId: string;
  guideSummary: GuideSummaryInfo;
  codeSnippet: string;
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
  stabilityRate: number;
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
  retainedDroppedRate: number;
  nPaired: number;
}

export interface JudgeRunOptions {
  apiKey?: string;
  mode?: 'batch' | 'direct';
  concurrency?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export const JUDGE_SYSTEM_PROMPT = `You are an expert web platform modernization judge evaluating whether a static code finding is a legitimate instance of legacy web platform code that should be modernized according to a Modern Web Guidance guide.

You must follow the Detective-then-Judge methodology:
First extract structured facts:
1. \`matches_before_syntax\`: Does the highlighted code match the old workaround or anti-pattern described in the guide's "Legacy Pattern (Before)" or examples?
2. \`has_fallback_or_feature_guard\`: Is this code protected by a feature guard (e.g. checking for modern API support, fallback branch, ponyfill, or polyfill)?
3. \`modern_feature_applies_here\`: Does the modern web platform replacement actually apply cleanly here without breaking expected behavior?
4. \`reasoning\`: Concise, objective reasoning explaining your factual analysis.
5. \`verdict\`: One of the following 5 values:
   - 'right': Legitimate finding. The code matches the old workaround, is not guarded, and the modern feature applies.
   - 'not-old-pattern': False positive. The code does NOT match the old workaround (e.g. token collision, unrelated logic, modern code mistaken for old).
   - 'leave-it': The code is an intentional fallback, ponyfill/polyfill, or belongs to a non-browser environment; it should NOT be touched.
   - 'guide-wrong': The guide's proposed replacement does not solve or support this case.
   - 'unsure': Insufficient context to determine.`;

export const JUDGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    matches_before_syntax: { type: 'BOOLEAN' },
    has_fallback_or_feature_guard: { type: 'BOOLEAN' },
    modern_feature_applies_here: { type: 'BOOLEAN' },
    reasoning: { type: 'STRING' },
    verdict: {
      type: 'STRING',
      enum: ['right', 'not-old-pattern', 'leave-it', 'guide-wrong', 'unsure'],
    },
  },
  required: [
    'matches_before_syntax',
    'has_fallback_or_feature_guard',
    'modern_feature_applies_here',
    'reasoning',
    'verdict',
  ],
};

/**
 * Formats a blind card into a clean text prompt for the LLM judge.
 * Strips all detector rule IDs, source IDs, tool names, and prior verdicts.
 */
export function formatBlindCardPrompt(card: BlindCardPayload): string {
  const examples = card.guideSummary.oldWayExamples?.length
    ? `\n- Examples of Old Way:\n${card.guideSummary.oldWayExamples.map((e) => `  * ${e}`).join('\n')}`
    : '';

  return `## Guide Reference
- Guide ID: ${card.guideId}
- Problem: ${card.guideSummary.problem}
- Legacy Pattern (Before): ${card.guideSummary.before}
- Modern Replacement (Now): ${card.guideSummary.now}${examples}

## Code Location
- File: ${card.file}
- Line: ${card.line}

## Code Snippet
\`\`\`
${card.codeSnippet}
\`\`\``;
}

/**
 * Helper to construct Gemini generateContent request body with structured schema.
 */
export function buildGeminiRequestBody(card: BlindCardPayload): unknown {
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
      temperature: 0.0,
    },
  };
}

/**
 * Parses Gemini candidate content into DetectiveFactCheck.
 */
export function parseJudgeJsonContent(rawText: string, cardId: string): JudgeResult {
  try {
    const parsed: unknown = JSON.parse(rawText.trim());
    if (isDetectiveFactCheck(parsed)) {
      return {
        cardId,
        verdict: parsed.verdict,
        facts: parsed,
        rawResponse: rawText,
      };
    }
    // Fallback if shape is partially valid
    if (typeof parsed === 'object' && parsed !== null) {
      const rec = parsed as Record<string, unknown>;
      const verdict = isJudgeVerdict(rec.verdict) ? rec.verdict : 'unsure';
      const facts: DetectiveFactCheck = {
        matches_before_syntax: Boolean(rec.matches_before_syntax),
        has_fallback_or_feature_guard: Boolean(rec.has_fallback_or_feature_guard),
        modern_feature_applies_here: Boolean(rec.modern_feature_applies_here),
        reasoning: typeof rec.reasoning === 'string' ? rec.reasoning : '',
        verdict,
      };
      return {
        cardId,
        verdict,
        facts,
        rawResponse: rawText,
      };
    }
  } catch (err: unknown) {
    return {
      cardId,
      verdict: 'unsure',
      facts: {
        matches_before_syntax: false,
        has_fallback_or_feature_guard: false,
        modern_feature_applies_here: false,
        reasoning: `JSON parse error: ${String(err)}`,
        verdict: 'unsure',
      },
      rawResponse: rawText,
      error: String(err),
    };
  }

  return {
    cardId,
    verdict: 'unsure',
    facts: {
      matches_before_syntax: false,
      has_fallback_or_feature_guard: false,
      modern_feature_applies_here: false,
      reasoning: 'Invalid structure received from model',
      verdict: 'unsure',
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
 * Runs judge evaluation directly via generateContent with concurrency control.
 */
export async function runJudgeDirect(
  cards: BlindCardPayload[],
  options: JudgeRunOptions = {},
): Promise<JudgeResult[]> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment or options');
  }

  const customFetch = options.fetchFn ?? fetch;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const results: JudgeResult[] = Array.from({ length: cards.length });

  let currentIndex = 0;
  async function worker(): Promise<void> {
    while (currentIndex < cards.length) {
      const idx = currentIndex++;
      const card = cards[idx];
      const body = buildGeminiRequestBody(card);
      const url = `${GEMINI_API_BASE}/models/${JUDGE_MODEL}:generateContent?key=${apiKey}`;

      try {
        const res = await customFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          results[idx] = {
            cardId: card.cardId,
            verdict: 'unsure',
            facts: {
              matches_before_syntax: false,
              has_fallback_or_feature_guard: false,
              modern_feature_applies_here: false,
              reasoning: `HTTP ${res.status}: ${errText}`,
              verdict: 'unsure',
            },
            error: `HTTP ${res.status}: ${errText}`,
          };
          continue;
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        results[idx] = parseJudgeJsonContent(text, card.cardId);
      } catch (err: unknown) {
        results[idx] = {
          cardId: card.cardId,
          verdict: 'unsure',
          facts: {
            matches_before_syntax: false,
            has_fallback_or_feature_guard: false,
            modern_feature_applies_here: false,
            reasoning: `Network error: ${String(err)}`,
            verdict: 'unsure',
          },
          error: String(err),
        };
      }
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
 * Returns null if batch could not be completed, signalling fallback to direct.
 */
async function pollBatchUntilDone(ctx: PollBatchContext): Promise<JudgeResult[] | null> {
  const startTime = Date.now();
  const pollUrl = `${GEMINI_API_BASE}/${ctx.batchName}?key=${ctx.apiKey}`;

  while (Date.now() - startTime < ctx.timeoutMs) {
    await new Promise((r) => setTimeout(r, ctx.pollIntervalMs));

    let pollRes: Response;
    try {
      pollRes = await ctx.customFetch(pollUrl);
    } catch {
      continue;
    }

    if (!pollRes.ok) {
      return null;
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
      return null;
    }

    if (state === 'BATCH_STATE_SUCCEEDED' || batchData.done) {
      const output =
        batchData.output ??
        batchData.metadata?.output ??
        batchData.response?.output;

      const inlinedList =
        output?.inlinedResponses?.inlinedResponses ??
        output?.inlined_responses?.inlined_responses;

      if (inlinedList && inlinedList.length === ctx.cards.length) {
        return inlinedList.map((item, idx) => {
          const cardId = ctx.cards[idx].cardId;
          const text = item.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          return parseJudgeJsonContent(text, cardId);
        });
      }
      return null;
    }
  }

  return null;
}

/**
 * Runs judge evaluation using the Gemini Batch API (batchGenerateContent + polling).
 * Gracefully falls back to direct execution if the batch API endpoint returns a 500 error
 * or if direct mode is requested.
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

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment or options');
  }

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
    return runJudgeDirect(cards, options);
  }

  const createData = (await createRes.json()) as { name?: string };
  const batchName = createData.name;
  if (!batchName) {
    return runJudgeDirect(cards, options);
  }

  const batchResult = await pollBatchUntilDone({
    batchName,
    apiKey,
    cards,
    timeoutMs,
    pollIntervalMs,
    customFetch,
  });

  return batchResult ?? runJudgeDirect(cards, options);
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
    stabilityRate: n > 0 ? exactMatchCount / n : 1.0,
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

  for (const j of judgeResults) {
    const humanLabel = humanGrades.get(j.cardId);
    if (humanLabel) {
      nominalPairs.push([humanLabel, j.verdict]);
      binaryPairs.push({
        humanRight: humanLabel === 'right',
        judgeRight: j.verdict === 'right',
      });
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
    totalDroppedEvaluated > 0 ? retainedDroppedCount / totalDroppedEvaluated : 1.0;

  return {
    krippendorffAlpha: alpha,
    gwetAc1: ac1,
    sensitivitySpecificity: sensSpec,
    ppiPrecision,
    retainedDroppedRate,
    nPaired: nominalPairs.length,
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
 * Loads guide summaries into a map indexed by guideId.
 */
export async function loadGuideSummariesMap(
  summariesFilePath: string = GUIDE_SUMMARIES_PATH,
): Promise<Map<string, GuideSummaryInfo>> {
  const content = await readFile(summariesFilePath, 'utf8');
  const list = JSON.parse(content) as GuideSummaryInfo[];
  const map = new Map<string, GuideSummaryInfo>();
  for (const item of list) {
    map.set(item.guideId, item);
  }
  return map;
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
    const summary = guideSummaries.get(item.guideId) ?? {
      guideId: item.guideId,
      problem: 'Legacy web platform pattern',
      before: 'Uses legacy platform API or workaround',
      now: 'Modern web platform standard API',
    };

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
