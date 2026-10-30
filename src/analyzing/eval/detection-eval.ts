import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import {
  JUDGE_VERSION,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET,
  PROMPT_MODEL,
  computeJudgePromptVersion,
  formatBlindCardPrompt,
} from './prompts.ts';
export {
  JUDGE_VERSION, JUDGE_SYSTEM_PROMPT, JUDGE_RESPONSE_SCHEMA,
  JUDGE_THINKING_BUDGET, computeJudgePromptVersion, formatBlindCardPrompt,
};
import {
  gwetAc1Nominal,
  krippendorffAlphaNominal,
  sensitivitySpecificity,
  type SensitivitySpecificityResult,
} from './stats.ts';
import { ALL_RULES } from '../rules/index.ts';
import { extractCompactSnippet } from '../scanners/context-slicer.ts';
import { computeGuideHash } from '../scanners/index.ts';
import type { AnalyzerRule } from '../schema.ts';
import {
  GEMINI_API_BASE,
  RETRYABLE_HTTP_STATUSES,
  buildGenerateContentUrl,
  fetchWithRetry,
  findGuideMarkdownPath,
  getGeminiApiKey,
  loadRawGuideMarkdown,
  resolveGeminiApiBase,
  type GeminiEndpointOptions,
} from '../llm-verifier.ts';
export {
  GEMINI_API_BASE, RETRYABLE_HTTP_STATUSES, buildGenerateContentUrl, fetchWithRetry,
  findGuideMarkdownPath, getGeminiApiKey, loadRawGuideMarkdown, resolveGeminiApiBase,
  type GeminiEndpointOptions,
};

const WORKTREE_ROOT = resolve(import.meta.dirname, '../../..');
const GUIDES_DIR = join(WORKTREE_ROOT, 'guides');

export const RULES_BY_ID: ReadonlyMap<string, AnalyzerRule> = new Map(
  ALL_RULES.map((r) => [r.id, r]),
);

export const RULES_BY_GUIDE_ID: ReadonlyMap<string, AnalyzerRule> = (() => {
  const map = new Map<string, AnalyzerRule>();
  for (const rule of ALL_RULES) {
    if (!map.has(rule.guideId)) {
      map.set(rule.guideId, rule);
    }
  }
  return map;
})();

function findMatchingRule(ruleId: string | undefined, guideId: string): AnalyzerRule | undefined {
  return (ruleId ? RULES_BY_ID.get(ruleId) : undefined) ?? RULES_BY_GUIDE_ID.get(guideId);
}

const sha256Hex12 = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 12);

/** Resolves the evaluation data directory (`ANALYZER_EVAL_DATA_DIR`), failing fast when unset. */
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

export function repoDir(
  entry: RepoConfigEntry,
  root: string = join(homedir(), '.cache', 'repos'),
): string {
  return entry.localPath
    ? resolve(entry.localPath.replace(/^~(?=\/)/, homedir()))
    : join(root, entry.repo);
}

export const JUDGE_MODEL = PROMPT_MODEL;

export type CanonicalJudgeVerdict =
  | 'legit-modernize-target'
  | 'not-old-pattern'
  | 'fallback-or-guard'
  | 'loses-behavior'
  | 'no-payoff'
  | 'guide-wrong'
  | 'unsure';

/**
 * Offline Detection Eval Judge verdict. Includes the 7 canonical verdicts plus legacy
 * pre-7-taxonomy labels (`'right' | 'leave-it'`) retained for historical human grade
 * (`grades.paulirish.jsonl`) and telemetry replay.
 */
export type JudgeVerdict = CanonicalJudgeVerdict | 'right' | 'leave-it';

export const CANONICAL_VERDICTS: ReadonlySet<string> = new Set([
  'legit-modernize-target', 'not-old-pattern', 'fallback-or-guard',
  'loses-behavior', 'no-payoff', 'guide-wrong', 'unsure',
]);

export const VALID_VERDICTS: ReadonlySet<string> = new Set([
  ...CANONICAL_VERDICTS, 'right', 'leave-it',
]);

const LEGACY_VERDICT_MAP: Readonly<Record<string, JudgeVerdict>> = {
  right: 'legit-modernize-target',
  legit: 'legit-modernize-target',
  false_positive: 'not-old-pattern',
  'leave-it': 'leave-it',
  'leave-it-be': 'leave-it',
};

const LEAVE_IT_VERDICTS: ReadonlySet<string> = new Set([
  'leave-it', 'leave-it-be', 'fallback-or-guard', 'loses-behavior', 'no-payoff',
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
    const candidate =
      typeof rec.subVerdict === 'string'
        ? rec.subVerdict
        : typeof rec.verdict === 'string'
          ? rec.verdict
          : undefined;
    return normalizeJudgeVerdict(candidate);
  }
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return LEGACY_VERDICT_MAP[raw] ?? (isJudgeVerdict(raw) ? raw : null);
}

export function isLeaveItFamily(v: string): boolean {
  return LEAVE_IT_VERDICTS.has(v);
}

export function verdictsAgree(humanVerdict: string, judgeVerdict: string): boolean {
  if (humanVerdict === judgeVerdict) return true;
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
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.matches_before_syntax === 'boolean' &&
    typeof r.has_fallback_or_feature_guard === 'boolean' &&
    typeof r.modern_feature_applies_here === 'boolean' &&
    (r.has_meaningful_payoff === undefined || typeof r.has_meaningful_payoff === 'boolean') &&
    typeof r.reasoning === 'string' &&
    isJudgeVerdict(r.verdict) &&
    (r.rawVerdict === undefined || isJudgeVerdict(r.rawVerdict)) &&
    (r.provenance === undefined || (typeof r.provenance === 'object' && r.provenance !== null))
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

/** Unbiased evaluation finding payload stripped of internal analyzer metadata, presenting only code context and guide specification to human raters and the Detection Eval Judge. */
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
  '', 'canary', 'calibration', 'none', 'unknown',
]);

export function computeRuleHash(rule: AnalyzerRule): string {
  return sha256Hex12(`${rule.id}:${JSON.stringify(rule.verifierRubric)}`);
}

/** Hashes the exact guide markdown body bytes interpolated into formatBlindCardPrompt(card) (`card.guideSummary.markdownBody.trim()`). Fails fast if missing or empty. */
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
  return sha256Hex12(trimmed);
}

export function computeExplainerContextHash(explainerContext?: string): string {
  const trimmed = explainerContext?.trim() ?? '';
  return trimmed ? sha256Hex12(trimmed) : 'none';
}

export function computeJudgeInputProvenance(
  card: BlindCardPayload,
  judgeVersion: string = JUDGE_VERSION,
): JudgeInputProvenance {
  const trimmedJudgeVersion = judgeVersion.trim();
  if (!trimmedJudgeVersion) {
    throw new Error(`computeJudgeInputProvenance failed: card ${card.cardId} has empty judgeVersion. Failing fast.`);
  }
  for (const [label, val] of [['ruleHash', card.ruleHash], ['guideHash', card.guideHash]] as const) {
    if (val !== undefined && INVALID_SENTINEL_HASHES.has(val.trim())) {
      throw new Error(
        `computeJudgeInputProvenance failed: card ${card.cardId} has invalid/sentinel ${label} "${val}". Failing fast.`,
      );
    }
  }

  const promptGuideHash =
    (card.guideSummary?.markdownBody?.trim() && card.guideSummary.promptGuideHash)
      ? card.guideSummary.promptGuideHash
      : computePromptGuideHash(
          card.guideSummary?.markdownBody,
          card.cardId,
          card.guideId,
        );
  const explainerContextHash =
    card.guideSummary?.explainerContextHash ??
    computeExplainerContextHash(card.guideSummary?.explainerContext);
  const matchedRule = findMatchingRule(card.ruleId, card.guideId);
  const ruleId = (card.ruleId || matchedRule?.id || card.guideId || '').trim();
  if (!ruleId) {
    throw new Error(`computeJudgeInputProvenance failed: card ${card.cardId} is missing ruleId/guideId. Failing fast.`);
  }

  return {
    judgeVersion: trimmedJudgeVersion,
    promptGuideHash,
    explainerContextHash,
    ruleId,
    ruleGuideHash: matchedRule ? matchedRule.guideHash : 'unregistered',
    ruleHash: card.ruleHash?.trim() || (matchedRule ? computeRuleHash(matchedRule) : 'unregistered'),
  };
}

export function attachJudgeInputProvenance(
  result: JudgeResult,
  card: BlindCardPayload,
  judgeVersion: string = JUDGE_VERSION,
): JudgeResult {
  const provenance = computeJudgeInputProvenance(card, judgeVersion);
  return { ...result, ...provenance, provenance, facts: { ...result.facts, provenance } };
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
  baseUrl?: string;
  concurrency?: number;
  fetchFn?: typeof fetch;
  temperature?: number;
}

/** Constructs Gemini generateContent request body with structured schema and thinking budget. */
export function buildGeminiRequestBody(card: BlindCardPayload, temperature = 0.2): unknown {
  return {
    systemInstruction: { parts: [{ text: JUDGE_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: formatBlindCardPrompt(card) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: JUDGE_RESPONSE_SCHEMA,
      temperature,
      thinkingConfig: { thinkingBudget: JUDGE_THINKING_BUDGET },
    },
  };
}

/** Cross-checks and computes unambiguous judge verdict from the 4 boolean facts. */
export function deriveJudgeVerdictFromFacts(
  facts: {
    matches_before_syntax: boolean;
    has_fallback_or_feature_guard: boolean;
    modern_feature_applies_here: boolean;
    has_meaningful_payoff?: boolean;
  },
  llmVerdict?: JudgeVerdict,
): JudgeVerdict {
  if (llmVerdict === 'guide-wrong' || llmVerdict === 'unsure') return llmVerdict;
  if (!facts.matches_before_syntax) return 'not-old-pattern';
  if (facts.has_fallback_or_feature_guard) return 'fallback-or-guard';
  if (!facts.modern_feature_applies_here) return 'loses-behavior';
  if (facts.has_meaningful_payoff === false) return 'no-payoff';
  return 'legit-modernize-target';
}

/** Parses Gemini candidate content into DetectionEvalFactCheck, failing fast on invalid JSON or schema violations. */
export function parseJudgeJsonContent(rawText: string, cardId: string): JudgeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
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

  const has_meaningful_payoff =
    parsed.has_meaningful_payoff ??
    (parsed.modern_feature_applies_here &&
      (parsed.verdict === 'legit-modernize-target' || parsed.verdict === 'right'));

  const factsWithDefault = { ...parsed, has_meaningful_payoff };
  const finalVerdict = deriveJudgeVerdictFromFacts(factsWithDefault, parsed.verdict);

  return {
    cardId,
    verdict: finalVerdict,
    facts: { ...factsWithDefault, verdict: finalVerdict, rawVerdict: parsed.verdict },
    rawResponse: rawText,
  };
}


/** Direct execution of the Detection Eval Judge across blind card finding payloads via Gemini LLM. */
export async function runJudgeDirect(
  cards: BlindCardPayload[],
  options: JudgeRunOptions = {},
): Promise<JudgeResult[]> {
  const url = buildGenerateContentUrl(JUDGE_MODEL, options);
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
      const res = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGeminiRequestBody(card, options.temperature)),
        },
        customFetch,
      );

      if (!res.ok) {
        throw new Error(
          `Gemini generateContent failed for card ${card.cardId} with HTTP ${res.status}: ${await res.text()}`,
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

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

/** Checks canary items with known ground-truth labels against judge results. */
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
    if (!actual) continue;
    pairs.push({
      humanRight: isPositiveVerdict(canary.expectedVerdict),
      judgeRight: isPositiveVerdict(actual),
    });
    if (!verdictsAgree(canary.expectedVerdict, actual)) {
      violations.push({ cardId: canary.cardId, expected: canary.expectedVerdict, actual });
    }
  }

  const { tpr, tnr, positives, negatives } = sensitivitySpecificity(pairs);
  const passed = tnr >= 1.0 && !violations.some((v) => !isPositiveVerdict(v.expected));
  return { passed, tpr, tnr, positives, negatives, violations };
}

const PROVENANCE_IDENTITY_KEYS = [
  'judgeVersion', 'promptGuideHash', 'explainerContextHash', 'ruleId', 'ruleGuideHash', 'ruleHash',
] as const;

function resolveMajorityConsensus(r0: JudgeResult, r1: JudgeResult, r2: JudgeResult): JudgeResult {
  for (const key of PROVENANCE_IDENTITY_KEYS) {
    const p0 = r0[key] ?? r0.provenance?.[key];
    const p1 = r1[key] ?? r1.provenance?.[key];
    const p2 = r2[key] ?? r2.provenance?.[key];
    if (p0 !== p1 || p0 !== p2) {
      throw new Error(
        `Stability run provenance mismatch on card ${r0.cardId} field "${key}": run0=${String(p0)}, run1=${String(p1)}, run2=${String(p2)}`,
      );
    }
  }

  const [v0, v1, v2] = [r0.verdict, r1.verdict, r2.verdict];
  const winner = v0 === v1 || v0 === v2 ? r0 : v1 === v2 ? r1 : null;
  const consensusVerdict: JudgeVerdict = winner ? winner.verdict : 'unsure';
  const chosenFacts: DetectionEvalFactCheck = winner
    ? winner.facts
    : { ...r0.facts, verdict: 'unsure', rawVerdict: 'unsure' };

  const { rawResponse: _rawResponse, error: _error, ...provenanceFields } = winner ?? r0;
  return { ...provenanceFields, verdict: consensusVerdict, facts: chosenFacts };
}

/** Evaluates 3-run judge stability and derives consensus majority verdicts. */
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

  const pairSets: [
    Array<readonly [string, string]>,
    Array<readonly [string, string]>,
    Array<readonly [string, string]>,
  ] = [[], [], []];
  let exactMatchCount = 0;
  const consensusResults: JudgeResult[] = [];

  for (let i = 0; i < n; i++) {
    const [r0, r1, r2] = [run0[i], run1[i], run2[i]];
    if (r0.cardId !== r1.cardId || r0.cardId !== r2.cardId) {
      throw new Error(
        `Stability run cardId mismatch at index ${i}: ${r0.cardId}, ${r1.cardId}, ${r2.cardId}`,
      );
    }
    pairSets[0].push([r0.verdict, r1.verdict]);
    pairSets[1].push([r1.verdict, r2.verdict]);
    pairSets[2].push([r0.verdict, r2.verdict]);
    if (r0.verdict === r1.verdict && r1.verdict === r2.verdict) exactMatchCount++;
    consensusResults.push(resolveMajorityConsensus(r0, r1, r2));
  }

  const pairwiseAlphas = pairSets.map(krippendorffAlphaNominal) as [number, number, number];
  const pairwiseAc1s = pairSets.map(gwetAc1Nominal) as [number, number, number];

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
  return isLeaveItFamily(v) ? 'leave-it' : (normalizeJudgeVerdict(v) ?? v);
}

/** Computes all admission guard metrics between judge results and reference human labels. */
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
      if (humanLabel === 'unsure') unsureCount++;
      else {
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
      if (!isPositiveVerdict(j.verdict)) retainedDroppedCount++;
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

/** Parses raw guide.md text into a GuideSummaryInfo directly from markdown body. */
export function parseGuideSummaryMarkdown(markdown: string, guideId: string): GuideSummaryInfo {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const fmDescription = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';

  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? guideId;
  const bodyWithoutTitle = body.replace(/^#\s+[^\n]+\n*/, '').trim();

  const sections = bodyWithoutTitle
    .split(/^(?=#{2,3}\s+)/m)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const m = chunk.match(/^#{2,3}\s+([^\n]+)\n?([\s\S]*)$/);
      return m
        ? { header: m[1].trim(), content: m[2].trim() }
        : { header: 'Introduction', content: chunk.trim() };
    });

  const introSection =
    sections.find((s) => s.header === 'Introduction')?.content ?? sections[0]?.content ?? '';
  const problemSection = sections.find(
    (s) => s.header.toLowerCase().includes('problem') && s.content,
  )?.content;
  const problem = problemSection || fmDescription || introSection.split('\n\n')[0] || title;

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

/** Loads the guide explainer context map from disk, resolving path via getAnalyzerEvalDataDir() when not provided. */
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
    const rec = list[idx] as Record<string, unknown> | null;
    const guideId = typeof rec?.guideId === 'string' ? rec.guideId.trim() : '';
    if (!guideId) {
      throw new Error(
        `Invalid explainer entry at index ${idx} in ${resolvedPath}: missing non-empty string guideId.`,
      );
    }
    const rawExcerpt = [rec!.combinedExcerpt, rec!.explainerContext, rec!.excerpt].find(
      (v): v is string => typeof v === 'string',
    );
    const combinedExcerpt = rawExcerpt?.trim() ?? '';
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
  readonly allowMissingExplainers?: boolean;
  readonly explainersPath?: string;
}

/** Loads guide summaries directly from markdown files into a map indexed by guideId, enriched only with external upstream feature explainers. */
export async function loadGuideSummariesMap(
  guidesRootDir: string = GUIDES_DIR,
  options: LoadGuideSummariesOptions = {},
): Promise<Map<string, GuideSummaryInfo>> {
  let explainersMap: Map<string, ExplainerContextEntry> | undefined;
  if (!options.allowMissingExplainers || options.explainersPath || process.env.ANALYZER_EVAL_DATA_DIR) {
    try {
      explainersMap = await loadExplainerContextMap(options.explainersPath);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null ? (err as NodeJS.ErrnoException).code : undefined;
      if (!options.allowMissingExplainers || code !== 'ENOENT') {
        if (code !== undefined) {
          throw new Error(
            `Failed to read required guide explainers file at ${options.explainersPath ?? ''}: ${String(err)}`,
          );
        }
        throw err;
      }
    }
  }

  const entries = await readdir(guidesRootDir, { recursive: true, withFileTypes: true });
  const map = new Map<string, GuideSummaryInfo>();

  for (const entry of entries) {
    if (!entry.isFile() || entry.name !== 'guide.md') continue;
    const parentDir = entry.parentPath ?? (entry as unknown as { path?: string }).path ?? '';
    const guideId = basename(parentDir);
    const fullPath = join(parentDir, entry.name);
    const rawContent = await readFile(fullPath, 'utf8');
    const summary = parseGuideSummaryMarkdown(rawContent, guideId);
    const explainer = explainersMap?.get(guideId);
    map.set(guideId, {
      ...summary,
      ...(explainer?.combinedExcerpt ? { explainerContext: explainer.combinedExcerpt } : {}),
      explainerContextHash: explainer?.explainerContextHash ?? 'none',
    });
  }

  if (map.size === 0) {
    throw new Error(`loadGuideSummariesMap loaded 0 guides from ${guidesRootDir}. Failing fast.`);
  }

  return map;
}

export interface PaulIrishGradesResult {
  cards: CalibrationDeckItem[];
  humanVerdicts: Map<string, JudgeVerdict>;
}

const STUB_OR_RETIRED_GUIDE_IDS: ReadonlySet<string> = new Set([
  'copy-button', 'dialog', 'css-layout', 'accessible-error-announcement',
  'stack-drill-down', 'shadow-dom', 'model-partial-time-concepts',
]);

async function collectDeckItemsFromDir(
  dir: string,
  allCardsMap: Map<string, CalibrationDeckItem>,
  maxDepth = 3,
): Promise<void> {
  if (maxDepth < 0) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectDeckItemsFromDir(fullPath, allCardsMap, maxDepth - 1);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const content = await readFile(fullPath, 'utf8');
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(content);
      } catch (err: unknown) {
        throw new Error(`Failed to parse deck JSON at ${fullPath}: ${String(err)}`);
      }
      for (const c of (Array.isArray(rawJson) ? rawJson : [rawJson]) as CalibrationDeckItem[]) {
        if (c && typeof c === 'object' && c.cardId) allCardsMap.set(c.cardId, c);
      }
    }
  }
}

/** Loads canonical human-graded cards from grades.jsonl and cards directory, returning only scored cards (excluding 'unsure'). */
export async function loadPaulIrishScoredCards(
  gradesPath?: string,
  cardsDir?: string,
): Promise<PaulIrishGradesResult> {
  const evalDataDir = !gradesPath || !cardsDir ? getAnalyzerEvalDataDir() : '';
  const resolvedGradesPath =
    gradesPath ?? process.env.GRADES_PATH ?? join(evalDataDir, 'labels', 'grades.jsonl');
  const resolvedCardsDir = cardsDir ?? join(evalDataDir, 'labels', 'cards');

  const content = await readFile(resolvedGradesPath, 'utf8');
  const latestGrades = new Map<string, JudgeVerdict>();
  for (const line of content.trim().split('\n').filter(Boolean)) {
    const parsed = JSON.parse(line) as { cardId: string; verdict: string };
    if (parsed.cardId && isJudgeVerdict(parsed.verdict)) {
      latestGrades.set(parsed.cardId, parsed.verdict);
    }
  }

  const allCardsMap = new Map<string, CalibrationDeckItem>();
  await collectDeckItemsFromDir(resolvedCardsDir, allCardsMap);
  await collectDeckItemsFromDir(dirname(resolvedCardsDir), allCardsMap, 0);

  const scoredCards: CalibrationDeckItem[] = [];
  const scoredVerdicts = new Map<string, JudgeVerdict>();

  for (const [cardId, verdict] of latestGrades.entries()) {
    if (verdict === 'unsure') continue;
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

/** Slices out code snippet around a line from file content. */
export function extractCodeSnippet(fileContent: string, targetLine: number, radius = 15): string {
  return extractCompactSnippet(fileContent, targetLine, radius);
}

/** Prepares BlindCardPayloads from calibration deck and checked out repos. */
export async function prepareBlindCards(
  items: ReadonlyArray<CalibrationDeckItem>,
  guideSummaries: ReadonlyMap<string, GuideSummaryInfo>,
  reposConfigPath?: string,
): Promise<BlindCardPayload[]> {
  let repoMap: Map<string, RepoConfigEntry> | undefined;
  const getRepoEntry = async (repo: string): Promise<RepoConfigEntry | undefined> => {
    if (!repoMap) {
      const resolvedReposPath = reposConfigPath ?? join(getAnalyzerEvalDataDir(), 'repos.json');
      const repoEntries = JSON.parse(await readFile(resolvedReposPath, 'utf8')) as RepoConfigEntry[];
      repoMap = new Map(repoEntries.map((r) => [r.repo, r]));
    }
    return repoMap.get(repo);
  };

  const blindCards: BlindCardPayload[] = [];
  for (const item of items) {
    const summary = guideSummaries.get(item.guideId);
    if (!summary?.markdownBody?.trim()) continue;

    let snippet = item.code ?? '';
    if (!snippet) {
      const repoEntry = await getRepoEntry(item.repo);
      if (repoEntry) {
        const fullPath = join(repoDir(repoEntry), item.file);
        snippet = await readFile(fullPath, 'utf8')
          .then((txt) => extractCodeSnippet(txt, item.line))
          .catch(() => `// Unable to read file at ${item.file}:${item.line}`);
      }
    }

    const effectiveRuleId = item.sourceId || item.guideId;
    const matchedRule = findMatchingRule(effectiveRuleId, item.guideId);
    blindCards.push({
      cardId: item.cardId,
      repo: item.repo,
      commit: item.commit,
      file: item.file,
      line: item.line,
      guideId: item.guideId,
      ruleId: effectiveRuleId,
      ruleHash: matchedRule ? computeRuleHash(matchedRule) : 'unregistered',
      guideHash:
        summary.promptGuideHash ??
        computePromptGuideHash(summary.markdownBody, item.cardId, item.guideId),
      guideSummary: summary,
      codeSnippet: snippet,
    });
  }

  return blindCards;
}
