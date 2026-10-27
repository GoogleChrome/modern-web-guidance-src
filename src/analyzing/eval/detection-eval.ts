/* oxlint-disable max-lines-per-function, max-depth */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export {
  JUDGE_VERSION,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  computeJudgePromptVersion,
  formatBlindCardPrompt,
} from './prompts.ts';
import {
  JUDGE_VERSION,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  computeJudgePromptVersion,
  formatBlindCardPrompt,
} from './prompts.ts';
import {
  gwetAc1Nominal,
  krippendorffAlphaNominal,
  sensitivitySpecificity,
  type SensitivitySpecificityResult,
} from './stats.ts';
import { ALL_RULES } from '../rules/index.ts';
import { computeGuideHash } from '../scanners/index.ts';
import type { AnalyzerRule, JudgeVerdict, CanonicalJudgeVerdict } from '../schema.ts';
export { type JudgeVerdict, type CanonicalJudgeVerdict, CANONICAL_VERDICTS } from '../schema.ts';
export { getGeminiApiKey, findGuideMarkdownPath, loadRawGuideMarkdown } from '../llm-verifier.ts';
import { getGeminiApiKey } from '../llm-verifier.ts';

const WORKTREE_ROOT = resolve(import.meta.dirname, '../../..');
const GUIDES_DIR = join(WORKTREE_ROOT, 'guides');

const RULES_INDEX: ReadonlyMap<string, AnalyzerRule> = (() => {
  const map = new Map<string, AnalyzerRule>();
  for (const rule of ALL_RULES) {
    map.set(rule.id, rule);
    if (!map.has(rule.guideId)) {
      map.set(rule.guideId, rule);
    }
  }
  return map;
})();

function findMatchingRule(ruleId: string | undefined, guideId: string): AnalyzerRule | undefined {
  return (ruleId ? RULES_INDEX.get(ruleId) : undefined) ?? RULES_INDEX.get(guideId);
}

/**
 * Resolves the directory containing offline evaluation datasets and human calibration labels.
 * When unset, functions requiring evaluation data fail fast with a descriptive error.
 */
export function getAnalyzerEvalDataDir(): string {
  const dir = process.env.ANALYZER_EVAL_DATA_DIR;
  if (!dir) {
    throw new Error(
      'ANALYZER_EVAL_DATA_DIR environment variable is not set. Please set ANALYZER_EVAL_DATA_DIR to point to your evaluation data directory.',
    );
  }
  return dir;
}

export interface RepoConfigEntry {
  readonly repo: string;
  readonly split: string;
  readonly localPath?: string;
  readonly commit?: string;
}

export function repoDir(entry: RepoConfigEntry, root: string = join(homedir(), '.cache', 'repos')): string {
  if (entry.localPath) {
    return resolve(entry.localPath.replace(/^~(?=\/)/, homedir()));
  }
  return join(root, entry.repo);
}

export const JUDGE_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const VALID_VERDICTS: ReadonlySet<string> = new Set([
  'legit-modernize-target',
  'not-old-pattern',
  'fallback-or-guard',
  'loses-behavior',
  'no-payoff',
  'guide-wrong',
  'unsure',
  'right',
  'leave-it',
]);

export function isJudgeVerdict(value: unknown): value is JudgeVerdict {
  return typeof value === 'string' && VALID_VERDICTS.has(value);
}

export function isPositiveVerdict(value: unknown): boolean {
  return value === 'legit-modernize-target' || value === 'right' || value === 'legit';
}

export function normalizeJudgeVerdict(raw: unknown): JudgeVerdict | null {
  if (typeof raw === 'object' && raw !== null) {
    const rec = raw as Record<string, unknown>;
    const sub = typeof rec.subVerdict === 'string' ? rec.subVerdict : undefined;
    const ver = typeof rec.verdict === 'string' ? rec.verdict : undefined;
    return normalizeJudgeVerdict(sub ?? ver);
  }
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  if (raw === 'right' || raw === 'legit') {
    return 'legit-modernize-target';
  }
  if (raw === 'false_positive') {
    return 'not-old-pattern';
  }
  if (raw === 'leave-it' || raw === 'leave-it-be') {
    return 'leave-it';
  }
  if (VALID_VERDICTS.has(raw)) {
    return raw as JudgeVerdict;
  }
  return null;
}

export function isLeaveItFamily(v: string): boolean {
  return (
    v === 'leave-it' ||
    v === 'leave-it-be' ||
    v === 'fallback-or-guard' ||
    v === 'loses-behavior' ||
    v === 'no-payoff'
  );
}

export function verdictsAgree(humanVerdict: string, judgeVerdict: string): boolean {
  if (humanVerdict === judgeVerdict) {
    return true;
  }
  const normH = normalizeJudgeVerdict(humanVerdict);
  const normJ = normalizeJudgeVerdict(judgeVerdict);
  return (
    (normH !== null && normH === normJ) ||
    (normH === 'leave-it' && isLeaveItFamily(judgeVerdict)) ||
    (normJ === 'leave-it' && isLeaveItFamily(humanVerdict))
  );
}

export interface JudgeInputProvenance {
  readonly judgeVersion: string;
  readonly promptGuideHash: string;
  readonly explainerContextHash: string;
  readonly ruleId: string;
  readonly ruleGuideHash: string;
  readonly ruleHash: string;
}

export interface DetectionEvalFactCheck {
  matches_before_syntax: boolean;
  has_fallback_or_feature_guard: boolean;
  modern_feature_applies_here: boolean;
  has_meaningful_payoff?: boolean;
  reasoning: string;
  verdict: JudgeVerdict;
  rawVerdict?: JudgeVerdict;
  provenance?: JudgeInputProvenance;
}

export function isDetectionEvalFactCheck(obj: unknown): obj is DetectionEvalFactCheck {
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
    (!('has_meaningful_payoff' in obj) || typeof (obj as { has_meaningful_payoff: unknown }).has_meaningful_payoff === 'boolean') &&
    'reasoning' in obj &&
    typeof obj.reasoning === 'string' &&
    'verdict' in obj &&
    isJudgeVerdict(obj.verdict) &&
    (!('rawVerdict' in obj) || obj.rawVerdict === undefined || isJudgeVerdict(obj.rawVerdict)) &&
    (!('provenance' in obj) || obj.provenance === undefined || (typeof obj.provenance === 'object' && obj.provenance !== null))
  );
}

export interface GuideSummaryInfo {
  guideId: string;
  guideHash?: string;
  promptGuideHash?: string;
  problem: string;
  markdownBody?: string;
  readonly explainerContext?: string;
  readonly explainerContextHash?: string;
}

/**
 * Unbiased evaluation finding payload stripped of internal analyzer metadata, presenting only code context and guide specification to human raters and the Detection Eval Judge.
 */
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
  facts: DetectionEvalFactCheck;
  judgeVersion?: string;
  promptGuideHash?: string;
  explainerContextHash?: string;
  ruleId?: string;
  ruleGuideHash?: string;
  ruleHash?: string;
  provenance?: JudgeInputProvenance;
  rawResponse?: string;
  error?: string;
}

const INVALID_SENTINEL_HASHES: ReadonlySet<string> = new Set([
  '',
  'canary',
  'calibration',
  'none',
  'unknown',
]);

export function computeRuleHash(rule: AnalyzerRule): string {
  return createHash('sha256')
    .update(rule.id)
    .update(':')
    .update(JSON.stringify(rule.verifierRubric))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Hashes the exact guide markdown body bytes interpolated into formatBlindCardPrompt(card)
 * (`card.guideSummary.markdownBody.trim()`). Fails fast if missing or empty; never falls back
 * to raw `guide.md` hash, `card.guideHash`, `rule.guideHash`, or sentinels.
 */
export function computePromptGuideHash(
  markdownBody?: string,
  cardId = 'unknown',
  guideId = 'unknown',
): string {
  const trimmed = markdownBody?.trim() ?? '';
  if (!trimmed) {
    throw new Error(
      `computePromptGuideHash failed: card ${cardId} (guideId: "${guideId}") is missing required guideSummary.markdownBody. Failing fast.`,
    );
  }
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 12);
}

export function computeExplainerContextHash(explainerContext?: string): string {
  const trimmed = explainerContext?.trim() ?? '';
  if (!trimmed) {
    return 'none';
  }
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 12);
}

export function computeJudgeInputProvenance(
  card: BlindCardPayload,
  judgeVersion: string = JUDGE_VERSION,
): JudgeInputProvenance {
  const trimmedJudgeVersion = judgeVersion.trim();
  if (!trimmedJudgeVersion) {
    throw new Error(
      `computeJudgeInputProvenance failed: card ${card.cardId} has empty judgeVersion. Failing fast.`,
    );
  }
  if (card.ruleHash !== undefined && INVALID_SENTINEL_HASHES.has(card.ruleHash.trim())) {
    throw new Error(
      `computeJudgeInputProvenance failed: card ${card.cardId} has invalid/sentinel ruleHash "${card.ruleHash}". Failing fast.`,
    );
  }
  if (card.guideHash !== undefined && INVALID_SENTINEL_HASHES.has(card.guideHash.trim())) {
    throw new Error(
      `computeJudgeInputProvenance failed: card ${card.cardId} has invalid/sentinel guideHash "${card.guideHash}". Failing fast.`,
    );
  }

  const promptGuideHash = computePromptGuideHash(
    card.guideSummary?.markdownBody,
    card.cardId,
    card.guideId,
  );
  const explainerContextHash = computeExplainerContextHash(card.guideSummary?.explainerContext);
  const matchedRule = findMatchingRule(card.ruleId, card.guideId);
  const ruleId = (card.ruleId || matchedRule?.id || card.guideId || '').trim();
  if (!ruleId) {
    throw new Error(
      `computeJudgeInputProvenance failed: card ${card.cardId} is missing ruleId/guideId. Failing fast.`,
    );
  }
  const ruleGuideHash = matchedRule ? matchedRule.guideHash : 'unregistered';
  const ruleHash = card.ruleHash?.trim() || (matchedRule ? computeRuleHash(matchedRule) : 'unregistered');

  return {
    judgeVersion: trimmedJudgeVersion,
    promptGuideHash,
    explainerContextHash,
    ruleId,
    ruleGuideHash,
    ruleHash,
  };
}

export function attachJudgeInputProvenance(
  result: JudgeResult,
  card: BlindCardPayload,
  judgeVersion: string = JUDGE_VERSION,
): JudgeResult {
  const provenance = computeJudgeInputProvenance(card, judgeVersion);
  return {
    ...result,
    ...provenance,
    provenance,
    facts: {
      ...result.facts,
      provenance,
    },
  };
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
  misfireAgreement?: number | null;
  actionabilityAgreement?: number | null;
  retainedDroppedRate: number | null;
  nPaired: number;
  unsureCount?: number;
}

export interface JudgeRunOptions {
  apiKey?: string;
  concurrency?: number;
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
 * Cross-checks and computes unambiguous judge verdict from the 4 boolean facts.
 */
export function deriveJudgeVerdictFromFacts(
  facts: {
    matches_before_syntax: boolean;
    has_fallback_or_feature_guard: boolean;
    modern_feature_applies_here: boolean;
    has_meaningful_payoff?: boolean;
  },
  llmVerdict?: JudgeVerdict,
): JudgeVerdict {
  if (llmVerdict === 'guide-wrong') {
    return 'guide-wrong';
  }
  if (llmVerdict === 'unsure') {
    return 'unsure';
  }
  if (!facts.matches_before_syntax) {
    return 'not-old-pattern';
  }
  if (facts.has_fallback_or_feature_guard) {
    return 'fallback-or-guard';
  }
  if (!facts.modern_feature_applies_here) {
    return 'loses-behavior';
  }
  if (facts.has_meaningful_payoff === false) {
    return 'no-payoff';
  }
  return 'legit-modernize-target';
}

/**
 * Parses Gemini candidate content into DetectionEvalFactCheck.
 * Fails fast with an explicit Error on invalid JSON or schema violations per Global Rules.
 * Cross-checks and derives unambiguous verdicts from structured facts.
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

  if (!isDetectionEvalFactCheck(parsed)) {
    throw new Error(
      `Judge response for card ${cardId} does not match schema: ${JSON.stringify(parsed)}\nRaw response: ${rawText}`,
    );
  }

  const effectiveMeaningfulPayoff =
    parsed.has_meaningful_payoff ??
    (parsed.modern_feature_applies_here &&
      (parsed.verdict === 'legit-modernize-target' || parsed.verdict === 'right'));

  const factsWithDefault = {
    ...parsed,
    has_meaningful_payoff: effectiveMeaningfulPayoff,
  };

  const finalVerdict = deriveJudgeVerdictFromFacts(factsWithDefault, parsed.verdict);

  return {
    cardId,
    verdict: finalVerdict,
    facts: {
      ...factsWithDefault,
      verdict: finalVerdict,
      rawVerdict: parsed.verdict,
    },
    rawResponse: rawText,
  };
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
 * Direct execution of the Detection Eval Judge across blind card finding payloads via Gemini LLM with concurrency control and retry backoff.
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
  const effectiveJudgeVersion =
    options.temperature === undefined
      ? JUDGE_VERSION
      : computeJudgePromptVersion(options.temperature);
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
      results[idx] = attachJudgeInputProvenance(
        parseJudgeJsonContent(text, card.cardId),
        card,
        effectiveJudgeVersion,
      );
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Checks canary items with known ground-truth labels against judge results.
 */
export function checkCanaries(
  results: ReadonlyArray<JudgeResult> | ReadonlyMap<string, JudgeVerdict>,
  canaries: ReadonlyArray<CanaryCard>,
): CanaryCheckResult {
  const verdictMap: ReadonlyMap<string, JudgeVerdict> =
    'get' in results ? results : new Map(results.map((r) => [r.cardId, r.verdict]));

  const pairs: Array<{ humanRight: boolean; judgeRight: boolean }> = [];
  const violations: CanaryCheckResult['violations'] = [];

  for (const canary of canaries) {
    const actual = verdictMap.get(canary.cardId);
    if (!actual) {
      continue;
    }
    pairs.push({
      humanRight: isPositiveVerdict(canary.expectedVerdict),
      judgeRight: isPositiveVerdict(actual),
    });

    if (!verdictsAgree(canary.expectedVerdict, actual)) {
      violations.push({
        cardId: canary.cardId,
        expected: canary.expectedVerdict,
        actual,
      });
    }
  }

  const { tpr, tnr, positives, negatives } = sensitivitySpecificity(pairs);
  const passed = tnr >= 1.0 && !violations.some((v) => !isPositiveVerdict(v.expected));

  return {
    passed,
    tpr,
    tnr,
    positives,
    negatives,
    violations,
  };
}

const PROVENANCE_IDENTITY_KEYS = [
  'judgeVersion',
  'promptGuideHash',
  'explainerContextHash',
  'ruleId',
  'ruleGuideHash',
  'ruleHash',
] as const;

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

  const getProvField = (r: JudgeResult, key: (typeof PROVENANCE_IDENTITY_KEYS)[number]) =>
    r[key] ?? r.provenance?.[key];

  for (let i = 0; i < n; i++) {
    const r0 = run0[i];
    const r1 = run1[i];
    const r2 = run2[i];

    if (r0.cardId !== r1.cardId || r0.cardId !== r2.cardId) {
      throw new Error(
        `Stability run cardId mismatch at index ${i}: ${r0.cardId}, ${r1.cardId}, ${r2.cardId}`,
      );
    }

    for (const key of PROVENANCE_IDENTITY_KEYS) {
      const p0 = getProvField(r0, key);
      const p1 = getProvField(r1, key);
      const p2 = getProvField(r2, key);
      if (p0 !== p1 || p0 !== p2) {
        throw new Error(
          `Stability run provenance mismatch on card ${r0.cardId} field "${key}": run0=${String(p0)}, run1=${String(p1)}, run2=${String(p2)}`,
        );
      }
    }

    const v0 = r0.verdict;
    const v1 = r1.verdict;
    const v2 = r2.verdict;

    pairs01.push([v0, v1]);
    pairs12.push([v1, v2]);
    pairs02.push([v0, v2]);

    if (v0 === v1 && v1 === v2) {
      exactMatchCount++;
    }

    let consensusVerdict: JudgeVerdict;
    let chosenFacts: DetectionEvalFactCheck;

    if (v0 === v1 || v0 === v2) {
      consensusVerdict = v0;
      chosenFacts = r0.facts;
    } else if (v1 === v2) {
      consensusVerdict = v1;
      chosenFacts = r1.facts;
    } else {
      consensusVerdict = 'unsure';
      chosenFacts = {
        ...r0.facts,
        verdict: 'unsure',
        rawVerdict: 'unsure',
      };
    }

    const provenanceSource = consensusVerdict === v1 && v0 !== v1 ? r1 : r0;
    const { rawResponse: _rawResponse, error: _error, ...provenanceFields } = provenanceSource;
    consensusResults.push({
      ...provenanceFields,
      verdict: consensusVerdict,
      facts: chosenFacts,
    });
  }

  const pairwiseAlphas: readonly [number, number, number] = [
    krippendorffAlphaNominal(pairs01),
    krippendorffAlphaNominal(pairs12),
    krippendorffAlphaNominal(pairs02),
  ];
  const pairwiseAc1s: readonly [number, number, number] = [
    gwetAc1Nominal(pairs01),
    gwetAc1Nominal(pairs12),
    gwetAc1Nominal(pairs02),
  ];

  return {
    stabilityRate: n > 0 ? exactMatchCount / n : null,
    krippendorffAlpha: (pairwiseAlphas[0] + pairwiseAlphas[1] + pairwiseAlphas[2]) / 3,
    gwetAc1: (pairwiseAc1s[0] + pairwiseAc1s[1] + pairwiseAc1s[2]) / 3,
    pairwiseAlphas,
    pairwiseAc1s,
    consensusResults,
  };
}

function collapseToLeaveItFamily(v: string): string {
  if (isLeaveItFamily(v)) {
    return 'leave-it';
  }
  return normalizeJudgeVerdict(v) ?? v;
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

  let retainedDroppedCount = 0;
  let totalDroppedEvaluated = 0;
  let unsureCount = 0;
  let misfireAgreementCount = 0;
  let actionabilityAgreementCount = 0;

  for (const j of judgeResults) {
    const humanLabel = humanGrades.get(j.cardId);
    if (humanLabel) {
      nominalPairs.push([collapseToLeaveItFamily(humanLabel), collapseToLeaveItFamily(j.verdict)]);
      if (humanLabel === 'unsure') {
        unsureCount++;
      } else {
        binaryPairs.push({
          humanRight: isPositiveVerdict(humanLabel),
          judgeRight: isPositiveVerdict(j.verdict),
        });
      }

      if ((humanLabel === 'not-old-pattern') === (j.verdict === 'not-old-pattern')) {
        misfireAgreementCount++;
      }

      if (isPositiveVerdict(humanLabel) === isPositiveVerdict(j.verdict)) {
        actionabilityAgreementCount++;
      }
    }

    if (droppedCardIds.has(j.cardId)) {
      totalDroppedEvaluated++;
      if (!isPositiveVerdict(j.verdict)) {
        retainedDroppedCount++;
      }
    }
  }

  const nPaired = nominalPairs.length;
  return {
    krippendorffAlpha: krippendorffAlphaNominal(nominalPairs),
    gwetAc1: gwetAc1Nominal(nominalPairs),
    sensitivitySpecificity: sensitivitySpecificity(binaryPairs),
    misfireAgreement: nPaired > 0 ? misfireAgreementCount / nPaired : null,
    actionabilityAgreement: nPaired > 0 ? actionabilityAgreementCount / nPaired : null,
    retainedDroppedRate:
      totalDroppedEvaluated > 0 ? retainedDroppedCount / totalDroppedEvaluated : null,
    nPaired,
    unsureCount,
  };
}

/**
 * Parses raw guide.md text into a GuideSummaryInfo directly from markdown body.
 */
export function parseGuideSummaryMarkdown(
  markdown: string,
  guideId: string,
): GuideSummaryInfo {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const fmDescription = descMatch ? descMatch[1].trim() : '';

  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : guideId;
  const bodyWithoutTitle = body.replace(/^#\s+[^\n]+\n*/, '').trim();

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

  const introSection =
    sections.find((s) => s.header === 'Introduction')?.content ?? sections[0]?.content ?? '';

  let problem = '';
  for (const s of sections) {
    const h = s.header.toLowerCase();
    if (h.includes('problem') && !problem) {
      problem = s.content;
    }
  }

  if (!problem) {
    problem = fmDescription || introSection.split('\n\n')[0] || title;
  }

  const clean = (str: string): string =>
    str.replace(/\{\{[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim();

  const cleanBody = clean(body);
  const maxBodyLength = 6000;
  const markdownBody =
    cleanBody.length > maxBodyLength
      ? cleanBody.slice(0, maxBodyLength) + '\n\n... (guide content truncated)'
      : cleanBody;

  const finalMarkdownBody = markdownBody.trim().length > 0 ? markdownBody : undefined;
  const promptGuideHash = finalMarkdownBody
    ? computePromptGuideHash(finalMarkdownBody, 'summary-parse', guideId)
    : undefined;

  return {
    guideId,
    guideHash: computeGuideHash(markdown),
    ...(promptGuideHash ? { promptGuideHash } : {}),
    problem: clean(problem),
    markdownBody: finalMarkdownBody,
  };
}

export interface ExplainerContextEntry {
  readonly combinedExcerpt: string;
  readonly explainerContextHash: string;
}

/**
 * Loads the guide explainer context map from disk.
 * Resolves path lazily via getAnalyzerEvalDataDir() when not provided,
 * failing fast if the evaluation data directory is not set or file cannot be read.
 */
export async function loadExplainerContextMap(
  explainersJsonPath?: string,
): Promise<Map<string, ExplainerContextEntry>> {
  const resolvedPath =
    explainersJsonPath ??
    join(getAnalyzerEvalDataDir(), 'findings', '2026-10-19-guide-explainers-171.json');
  const content = await readFile(resolvedPath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    throw new Error(`Failed to parse guide explainers JSON at ${resolvedPath}: ${String(err)}`);
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { guides?: unknown }).guides)
      ? (parsed as { guides: unknown[] }).guides
      : null;

  if (!list || list.length === 0) {
    throw new Error(
      `Invalid explainers file ${resolvedPath}: expected a non-empty array of guide explainer records.`,
    );
  }

  const map = new Map<string, ExplainerContextEntry>();
  for (let idx = 0; idx < list.length; idx++) {
    const item = list[idx];
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as { guideId?: unknown }).guideId !== 'string' ||
      !(item as { guideId: string }).guideId.trim()
    ) {
      throw new Error(
        `Invalid explainer entry at index ${idx} in ${resolvedPath}: missing non-empty string guideId.`,
      );
    }
    const rec = item as Record<string, unknown>;
    const guideId = (rec.guideId as string).trim();
    const rawExcerpt =
      typeof rec.combinedExcerpt === 'string'
        ? rec.combinedExcerpt
        : typeof rec.explainerContext === 'string'
          ? rec.explainerContext
          : typeof rec.excerpt === 'string'
            ? rec.excerpt
            : '';
    const combinedExcerpt = rawExcerpt.trim();
    if (combinedExcerpt) {
      map.set(guideId, {
        combinedExcerpt,
        explainerContextHash: computeExplainerContextHash(combinedExcerpt),
      });
    }
  }

  return map;
}

export interface LoadGuideSummariesOptions {
  /**
   * Explicit escape hatch for isolated unit tests that construct synthetic temporary
   * guide directories without an explainers dataset. Never set in production scripts.
   */
  readonly allowMissingExplainers?: boolean;
  readonly explainersPath?: string;
}

/**
 * Loads guide summaries directly from markdown files into a map indexed by guideId,
 * enriched only with external upstream feature explainers (never rule-writer triage text).
 * Fails fast on missing/unreadable guide directories, empty guide sets,
 * or missing/corrupt explainer datasets.
 */
export async function loadGuideSummariesMap(
  guidesRootDir: string = GUIDES_DIR,
  options: LoadGuideSummariesOptions = {},
): Promise<Map<string, GuideSummaryInfo>> {
  const map = new Map<string, GuideSummaryInfo>();

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === 'guide.md') {
        const guideId = basename(dir);
        const content = await readFile(fullPath, 'utf8');
        map.set(guideId, parseGuideSummaryMarkdown(content, guideId));
      }
    }
  }

  await walk(guidesRootDir);

  if (map.size === 0) {
    throw new Error(
      `loadGuideSummariesMap loaded 0 guides from ${guidesRootDir}. Failing fast.`,
    );
  }

  if (options.allowMissingExplainers && !options.explainersPath && !process.env.ANALYZER_EVAL_DATA_DIR) {
    return map;
  }

  let explainersMap: Map<string, ExplainerContextEntry>;
  try {
    explainersMap = await loadExplainerContextMap(options.explainersPath);
  } catch (err: unknown) {
    if (
      options.allowMissingExplainers &&
      typeof err === 'object' &&
      err !== null &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return map;
    }
    if (typeof err === 'object' && err !== null && 'code' in err) {
      throw new Error(
        `Failed to read required guide explainers file at ${options.explainersPath ?? ''}: ${String(err)}`,
      );
    }
    throw err;
  }

  for (const [guideId, existing] of map.entries()) {
    const explainer = explainersMap.get(guideId);
    map.set(guideId, {
      ...existing,
      ...(explainer?.combinedExcerpt ? { explainerContext: explainer.combinedExcerpt } : {}),
      explainerContextHash: computeExplainerContextHash(explainer?.combinedExcerpt),
    });
  }

  return map;
}

export interface PaulIrishGradesResult {
  cards: CalibrationDeckItem[];
  humanVerdicts: Map<string, JudgeVerdict>;
}

const STUB_OR_RETIRED_GUIDE_IDS: ReadonlySet<string> = new Set([
  'copy-button',
  'dialog',
  'css-layout',
  'accessible-error-announcement',
  'stack-drill-down',
  'shadow-dom',
  'model-partial-time-concepts',
]);

/**
 * Loads canonical human-graded cards from grades.jsonl and cards directory.
 * Returns only the scored cards (excluding 'unsure').
 */
export async function loadPaulIrishScoredCards(
  gradesPath?: string,
  cardsDir?: string,
): Promise<PaulIrishGradesResult> {
  const evalDataDir = !gradesPath || !cardsDir ? getAnalyzerEvalDataDir() : '';
  const resolvedGradesPath =
    gradesPath ??
    process.env.GRADES_PATH ??
    join(evalDataDir, 'labels', 'grades.jsonl');
  const resolvedCardsDir = cardsDir ?? join(evalDataDir, 'labels', 'cards');

  const content = await readFile(resolvedGradesPath, 'utf8');
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

  await scanDirectory(resolvedCardsDir);
  await scanDirectory(dirname(resolvedCardsDir), 0);

  const scoredCards: CalibrationDeckItem[] = [];
  const scoredVerdicts = new Map<string, JudgeVerdict>();

  for (const [cardId, verdict] of latestGrades.entries()) {
    if (verdict === 'unsure') {
      continue;
    }
    const card = allCardsMap.get(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} in ${resolvedGradesPath} not found in ${resolvedCardsDir}`);
    }
    const isCanaryCard = cardId === '2547b2ba6d74' || cardId === '7f2a96f62a4c';
    const isDropped = (card.verifierDecision ?? card.phase2Decision) === 'drop';
    if (!isCanaryCard && (STUB_OR_RETIRED_GUIDE_IDS.has(card.guideId) || isDropped)) {
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
  verifierDecision?: string;
  verifierReason?: string | null;
  verifierConfidence?: string;
  phase2Decision?: string;
  phase2Reason?: string | null;
  phase2Confidence?: string;
  populationCounts?: { low: number; medium: number; high: number; unknown: number };
  findings?: readonly CalibrationDeckFinding[];
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
  reposConfigPath?: string,
): Promise<BlindCardPayload[]> {
  let repoMap: Map<string, RepoConfigEntry> | undefined;
  const getRepoEntry = async (repo: string): Promise<RepoConfigEntry | undefined> => {
    if (!repoMap) {
      const resolvedReposPath =
        reposConfigPath ?? join(getAnalyzerEvalDataDir(), 'repos.json');
      const reposContent = await readFile(resolvedReposPath, 'utf8');
      const repoEntries = JSON.parse(reposContent) as RepoConfigEntry[];
      repoMap = new Map(repoEntries.map((r) => [r.repo, r]));
    }
    return repoMap.get(repo);
  };

  const blindCards: BlindCardPayload[] = [];

  for (const item of items) {
    const summary = guideSummaries.get(item.guideId);
    if (!summary?.markdownBody?.trim()) {
      continue;
    }

    let snippet = item.code ?? '';
    if (!snippet) {
      const repoEntry = await getRepoEntry(item.repo);
      if (repoEntry) {
        const fullPath = join(repoDir(repoEntry), item.file);
        try {
          const content = await readFile(fullPath, 'utf8');
          snippet = extractCodeSnippet(content, item.line);
        } catch {
          snippet = `// Unable to read file at ${item.file}:${item.line}`;
        }
      }
    }

    const promptGuideHash = computePromptGuideHash(
      summary.markdownBody,
      item.cardId,
      item.guideId,
    );
    const effectiveRuleId = item.sourceId || item.guideId;
    const matchedRule = findMatchingRule(effectiveRuleId, item.guideId);
    const computedRuleHash = matchedRule ? computeRuleHash(matchedRule) : 'unregistered';
    blindCards.push({
      cardId: item.cardId,
      repo: item.repo,
      commit: item.commit,
      file: item.file,
      line: item.line,
      guideId: item.guideId,
      ruleId: effectiveRuleId,
      ruleHash: computedRuleHash,
      guideHash: promptGuideHash,
      guideSummary: summary,
      codeSnippet: snippet,
    });
  }

  return blindCards;
}
