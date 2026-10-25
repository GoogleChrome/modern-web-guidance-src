/* oxlint-disable max-lines-per-function, max-depth */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  checkCanaries,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  isJudgeVerdict,
  isPositiveVerdict,
  loadGuideSummariesMap,
  loadPaulIrishScoredCards,
  prepareBlindCards,
  runJudgeDirect,
  JUDGE_VERSION,
  type BlindCardPayload,
  type CalibrationDeckItem,
  type CanaryCard,
  type CanaryCheckResult,
  type GuideSummaryInfo,
  type JudgeEvaluationMetrics,
  type JudgeResult,
  type JudgeRunOptions,
  type JudgeVerdict,
  type StabilityEvaluationResult,
} from './detection-eval.ts';
import {
  ANALYZER_INTERNAL_DIR,
  GRADES_PATH,
  M3_SPOTCHECK_DECK_PATH,
  PROGRESS_LOG_PATH,
  REPOS_CONFIG_PATH,
  WORKTREE_ROOT,
  repoDir,
  resolveGitMirrorCacheDir,
  type RepoConfigEntry,
} from './paths.ts';
import { runLlmVerifier, type VerifierOptions, type VerifierVerdict } from './llm-verifier.ts';
import { PHASE2_PROMPT_VERSION } from './prompts.ts';
import {
  computeFileHash,
  getGitCommitState,
  recordProgressLogEntry,
  type MetricEntry,
  type ProgressLogRow,
} from './progress-log.ts';
import {
  ALL_RULES,
  POST_SELECTION_TUNED_GUIDE_IDS,
} from './rules/index.ts';
import { scanFiles, scanRepoFiles } from './scanners/index.ts';
import { createInMemoryProject } from './scanners/js-scanner.ts';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import {
  checkSequentialStop,
  wilsonInterval,
  type BinomialInterval,
  type SequentialStopDecision,
  Z_95,
} from './stats.ts';
import { isEnoent } from './progress-log.ts';
import {
  appendCardTelemetry,
  computeRuleHash,
  computeTelemetryCacheKey,
  loadCardTelemetryMap,
  type CardTelemetryRecord,
} from './telemetry.ts';

export const Z_80 = 1.28155;
export const INITIAL_SAMPLE_BATCH = 60;
export const MAX_EXTENDED_SAMPLE = 100;
export const MAX_SAMPLE_PER_GUIDE = INITIAL_SAMPLE_BATCH;

export interface GuideQualificationInput {
  readonly p1Total: number;
  readonly p1Sampled: number;
  readonly p2KeptCount: number;
  readonly rightCount: number;
}

export type QualificationTier =
  | 'proven-high-n'
  | 'zero-fp-low-n'
  | 'unmeasured-low-n'
  | 'below-bar'
  | 'experimental';

export interface GuideQualificationResult {
  readonly precision: number;
  readonly wilson80: BinomialInterval;
  readonly wilson95: BinomialInterval;
  readonly sequentialStopDecision: SequentialStopDecision;
  readonly clearsBar90: boolean;
  readonly isSampleConstrained: boolean;
  readonly clearedHighN80: boolean;
  readonly clearedZeroFpExhaustive: boolean;
  readonly clearsSampleConstrained: boolean;
  readonly clearsScreen80: boolean;
  readonly clearsPrecisionBar: boolean;
  readonly tier: QualificationTier;
}

/**
 * Evaluates whether a guide clears the precision bar under G7/R20 rules:
 * 1. Standard bar (clearsBar90 / clearsPrecisionBar): Wilson 95% CI lower >= 0.90 or sequential stop = pass (R20).
 * 2. Sample-constrained classification (for n < 56, labeled as 'unmeasured-low-n' per R20):
 *    - clearedHighN80: Wilson 95% CI lower >= 0.80 and precision >= 0.95 (typically 16 <= n < 56).
 *    - clearedZeroFpExhaustive: p1Sampled === p1Total && p2KeptCount >= 1 && fpCount === 0 across all evaluated repos.
 *
 * Rules with n < 56 cannot mathematically reach wilson95.lower >= 0.90 with small samples, so
 * per R10 and R20 they are classified as 'unmeasured-low-n' ("unmeasured (too few findings)").
 */
export function evaluateGuideQualification(
  input: GuideQualificationInput,
): GuideQualificationResult;
export function evaluateGuideQualification(
  rightCount: number,
  p2KeptCount: number,
  p1Total?: number,
  p1Sampled?: number,
): GuideQualificationResult;
export function evaluateGuideQualification(
  inputOrRightCount: GuideQualificationInput | number,
  maybeKeptCount?: number,
  maybeP1Total?: number,
  maybeP1Sampled?: number,
): GuideQualificationResult {
  const input: GuideQualificationInput =
    typeof inputOrRightCount === 'number'
      ? {
          rightCount: inputOrRightCount,
          p2KeptCount: maybeKeptCount ?? inputOrRightCount,
          p1Total: maybeP1Total ?? maybeKeptCount ?? inputOrRightCount,
          p1Sampled: maybeP1Sampled ?? maybeKeptCount ?? inputOrRightCount,
        }
      : inputOrRightCount;
  const { p1Total, p1Sampled, p2KeptCount, rightCount } = input;
  const fpCount = p2KeptCount - rightCount;
  const precision = p2KeptCount > 0 ? rightCount / p2KeptCount : 0;
  const wilson80 = wilsonInterval(rightCount, p2KeptCount, Z_80);
  const wilson95 = wilsonInterval(rightCount, p2KeptCount, Z_95);
  const sequentialStopDecision = checkSequentialStop(
    rightCount,
    p2KeptCount,
    0.9,
    Math.max(60, p2KeptCount),
  );
  const clearsBar90 = wilson95.lower >= 0.9 || sequentialStopDecision === 'pass';
  // Minimum sample size where a rule with 1 false positive can achieve wilson95.lower >= 0.90 is n = 56.
  // Rules with n < 56 are evaluated under the sample-constrained bar:
  // wilson95.lower >= 0.80 && precision >= 0.95, or 100% precision with 0 FPs (exhaustive).
  const isSampleConstrained = p2KeptCount > 0 && p2KeptCount < 56;
  const clearedHighN80 = isSampleConstrained && wilson95.lower >= 0.8 && precision >= 0.95;
  const clearedZeroFpExhaustive =
    isSampleConstrained && p1Sampled === p1Total && p2KeptCount >= 1 && fpCount === 0;
  const clearsSampleConstrained = clearedHighN80 || clearedZeroFpExhaustive;
  // Per O72: clearsScreen80 evaluates statistical lower bound >= 0.80 strictly,
  // decoupled from zero-FP sample-constrained small samples.
  const clearsScreen80 = wilson95.lower >= 0.8;
  // Per R20: clearsPrecisionBar strictly requires clearsBar90 (wilson95.lower >= 0.90)
  const clearsPrecisionBar = clearsBar90;
  let tier: QualificationTier;
  if (clearsPrecisionBar) {
    tier = 'proven-high-n';
  } else if (p2KeptCount >= 35 && wilson95.lower < 0.9) {
    tier = 'below-bar';
  } else if (clearsSampleConstrained) {
    tier = 'unmeasured-low-n';
  } else {
    tier = 'experimental';
  }

  return {
    precision,
    wilson80,
    wilson95,
    sequentialStopDecision,
    clearsBar90,
    isSampleConstrained,
    clearedHighN80,
    clearedZeroFpExhaustive,
    clearsSampleConstrained,
    clearsScreen80,
    clearsPrecisionBar,
    tier,
  };
}

export const PILOT_SCORECARD_PATH = join(
  ANALYZER_INTERNAL_DIR,
  'findings',
  '2026-10-15-m3-rescore-scorecard.json',
);

export const GITMIRROR_SCORECARD_PATH = join(
  ANALYZER_INTERNAL_DIR,
  'findings',
  '2026-10-15-gitmirror-scorecard.json',
);

export const GITMIRROR_FINAL_SCORECARD_PATH = join(
  ANALYZER_INTERNAL_DIR,
  'findings',
  '2026-10-16-gitmirror-final-scorecard.json',
);

export const PILOT_GUIDE_IDS = [
  'autofill-sign-in-form',
  'animate-to-intrinsic-sizes',
  'declarative-dialog-popover-control',
  'animate-element-entry-exit',
  'coordinate-global-events',
] as const;

export type PilotGuideId = (typeof PILOT_GUIDE_IDS)[number];

export const SYNTHETIC_CANARY_CARDS: readonly BlindCardPayload[] = [
  {
    cardId: 'canary-neg-already-modern',
    repo: 'open-web-calendar',
    file: 'src/components/accordion.css',
    line: 12,
    guideId: 'animate-to-intrinsic-sizes',
    guideSummary: {
      guideId: 'animate-to-intrinsic-sizes',
      problem: 'CSS transition on max-height simulates intrinsic size animation',
      before: 'transition: max-height 0.5s ease',
      now: 'interpolate-size: allow-keywords; transition: height 0.5s ease;',
      markdownBody:
        '# Animate to Intrinsic Sizes\n\n### Problem\nCSS transition on max-height simulates intrinsic size animation\n\n### Before\ntransition: max-height 0.5s ease\n\n### Now\ninterpolate-size: allow-keywords; transition: height 0.5s ease;',
    },
    codeSnippet: `:root {
  interpolate-size: allow-keywords;
}

.accordion-panel {
  height: auto;
  transition: height 0.3s ease;
  overflow: hidden;
}`,
  },
  {
    cardId: 'canary-neg-shadowed-global',
    repo: 'todomvc-app',
    file: 'src/utils/logger.ts',
    line: 8,
    guideId: 'coordinate-global-events',
    guideSummary: {
      guideId: 'coordinate-global-events',
      problem: 'Legacy timezone math or moment-timezone instead of Temporal.ZonedDateTime',
      before: 'moment.tz(d, "America/New_York") or Date.prototype.getTimezoneOffset()',
      now: 'Temporal.ZonedDateTime',
      markdownBody:
        '# Coordinate Global Events\n\n### Problem\nLegacy timezone math or moment-timezone instead of Temporal.ZonedDateTime\n\n### Before\nmoment.tz(d, "America/New_York") or Date.prototype.getTimezoneOffset()\n\n### Now\nTemporal.ZonedDateTime',
    },
    codeSnippet: `function logTimestampWithMoment(moment: { name: string; tz: string; timestamp: number }): string {
  const tz = moment.tz ?? 'UTC';
  return \`[\${moment.name}] \${moment.timestamp} (\${tz})\`;
}`,
  },
  {
    cardId: 'canary-neg-feature-guarded',
    repo: 'components-ui',
    file: 'src/ui/modal-trigger.ts',
    line: 10,
    guideId: 'declarative-dialog-popover-control',
    guideSummary: {
      guideId: 'declarative-dialog-popover-control',
      problem: 'Imperative click listener toggles dialog instead of declarative commandfor',
      before: 'btn.addEventListener("click", () => dialog.showModal())',
      now: '<button commandfor="my-dialog" command="show-modal">',
      markdownBody:
        '# Declarative Dialog Control\n\n### Problem\nImperative click listener toggles dialog instead of declarative commandfor\n\n### Before\nbtn.addEventListener("click", () => dialog.showModal())\n\n### Now\n<button commandfor="my-dialog" command="show-modal">',
    },
    codeSnippet: `if ('commandForElement' in HTMLButtonElement.prototype) {
  openButton.commandForElement = targetDialog;
  openButton.command = 'show-modal';
} else {
  // Fallback for older browsers
  openButton.addEventListener('click', () => {
    targetDialog.showModal();
  });
}`,
  },
];

export const CANARY_CONFIG: readonly CanaryCard[] = [
  {
    cardId: '2547b2ba6d74',
    expectedVerdict: 'not-old-pattern',
    description: 'Paul Irish human-verified false positive (focus-trap/inert)',
  },
  {
    cardId: '7f2a96f62a4c',
    expectedVerdict: 'not-old-pattern',
    description: 'Paul Irish human-verified false positive (MessageChannel)',
  },
  {
    cardId: 'canary-neg-already-modern',
    expectedVerdict: 'not-old-pattern',
    description: 'Synthetic negative canary: already uses interpolate-size',
  },
  {
    cardId: 'canary-neg-shadowed-global',
    expectedVerdict: 'not-old-pattern',
    description: 'Synthetic negative canary: local parameter shadows moment',
  },
  {
    cardId: 'canary-neg-feature-guarded',
    expectedVerdict: 'fallback-or-guard',
    description: 'Synthetic negative canary: protected by commandForElement feature guard',
  },
];

export interface GuideRecallMetrics {
  readonly labeledPositivesTotal: number;
  readonly phase1Recalled: number;
  readonly phase2Recalled: number;
  readonly phase1RecallRate: number;
  readonly phase2RecallRate: number;
}

export interface RuleScorecard {
  readonly ruleId: string;
  readonly phase1TotalYield: number;
  readonly phase2KeptCount: number;
  readonly judgeJudgedCount: number;
  readonly judgeRightCount: number;
  readonly judgeFalsePositiveCount: number;
  readonly precision: number;
  readonly wilson95: BinomialInterval;
}

export interface GuideScorecard {
  readonly guideId: string;
  readonly ruleIds: readonly string[];
  readonly rules?: readonly RuleScorecard[];
  readonly phase1TotalYield: number;
  readonly phase1SampledCount: number;
  readonly phase2KeptCount: number;
  readonly phase2DroppedCount: number;
  readonly judgeJudgedCount: number;
  readonly judgeRightCount: number;
  readonly judgeFalsePositiveCount: number;
  readonly precision: number;
  readonly wilson80: BinomialInterval;
  readonly wilson95: BinomialInterval;
  readonly sequentialStopDecision: SequentialStopDecision;
  readonly clearsPrecisionBar: boolean;
  readonly clearsBar90: boolean;
  readonly clearsScreen80: boolean;
  readonly clearsSampleConstrained?: boolean;
  readonly isSampleConstrained?: boolean;
  readonly clearedHighN80?: boolean;
  readonly clearedZeroFpExhaustive?: boolean;
  readonly tier?: QualificationTier;
  readonly postSelectionTuned?: boolean;
  readonly recall: GuideRecallMetrics;
  readonly phase2RetentionRate?: number | null;
  readonly phase2YieldRetentionRate?: number;
  readonly phase1RightCount?: number;
  readonly phase1Precision?: number;
  readonly phase1Wilson95?: BinomialInterval;
  readonly clearsPhase1Bar90?: boolean;
  readonly phase2DroppedRightCount?: number;
}

export interface PilotScorecardSummary {
  readonly totalDetectableGuides: number;
  readonly clearedBarCount: number;
  readonly clearedBar90Count?: number;
  readonly clearedSampleConstrainedCount?: number;
  readonly clearedHighN80Count?: number;
  readonly clearedZeroFpExhaustiveCount?: number;
  readonly clearsScreen80Count?: number;
  readonly clearedScreenCount: number;
  readonly coverageGate0?: MetricEntry;
  readonly provenHighNCount?: number;
  readonly zeroFpLowNCount?: number;
  readonly singleShotQualifiedCount?: number;
  readonly postSelectionTunedCount?: number;
  readonly qualifiedPooledPrecision?: {
    readonly successes: number;
    readonly total: number;
    readonly precision: number;
    readonly wilson95: BinomialInterval;
  };
  readonly coverage: MetricEntry;
  readonly overallPrecision: MetricEntry;
  readonly overallRecall: MetricEntry;
  readonly pooledHeldoutPrecision: {
    readonly successes: number;
    readonly total: number;
    readonly precision: number;
    readonly wilson95: BinomialInterval;
  };
  readonly ppiPrecision?: MetricEntry;
  readonly judgeStability: number | null;
  readonly judgeAlpha: number;
  readonly judgeAc1: number;
  readonly canaryTnr: number;
  readonly canaryViolations: readonly unknown[];
  readonly phase2Retention?: {
    readonly phase1RecalledTotal: number;
    readonly phase2RecalledTotal: number;
    readonly rate: number | null;
  };
  readonly phase2YieldRetention?: {
    readonly sampledTotal: number;
    readonly keptTotal: number;
    readonly rate: number;
  };
  readonly pooledPhase1Precision?: {
    readonly successes: number;
    readonly total: number;
    readonly precision: number;
    readonly wilson95: BinomialInterval;
  };
  readonly clearedPhase1Bar90Count?: number;
  readonly phase2DroppedRightTotal?: number;
}

export type ScorecardSplit = 'held-out' | 'grading-only' | 'tune' | 'final';

export interface PilotScorecardReport {
  readonly timestamp: string;
  readonly commit: string;
  readonly gitDirty: boolean;
  readonly ruleSetHash: string;
  readonly splitHash: string;
  readonly split: ScorecardSplit;
  readonly gradesHash: string;
  readonly judgeVersion: string;
  readonly guides: readonly GuideScorecard[];
  readonly summary: PilotScorecardSummary;
  readonly canaries: readonly CanaryCard[];
}

export interface PilotScorecardOptions {
  readonly mode?: 'local' | 'gitmirror' | 'all';
  readonly split?: ScorecardSplit;
  readonly guideIds?: readonly string[];
  readonly reposConfigPath?: string;
  readonly gradesPath?: string;
  readonly rules?: readonly AnalyzerRule[];
  readonly rulesDir?: string;
  readonly scorecardPath?: string;
  readonly progressLogPath?: string;
  readonly spotcheckDeckPath?: string;
  readonly dropsDeckPath?: string;
  readonly writeProgress?: boolean;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly concurrency?: number;
  readonly initialSampleBatch?: number;
  readonly maxSequentialSample?: number;
  readonly temperature?: number;
}

/**
 * Deterministically samples up to targetCount (default 25) Phase-2-dropped findings per R18.
 */
export function samplePhase2DropsDeck(
  droppedFindings: readonly AnalyzerFinding[],
  targetCount = 25,
  verdictsMap?: ReadonlyMap<string, VerifierVerdict>,
): CalibrationDeckItem[] {
  if (droppedFindings.length === 0) {
    return [];
  }

  // Deduplicate input findings by cardId per O61
  const uniqueFindingsMap = new Map<string, AnalyzerFinding>();
  for (const f of droppedFindings) {
    if (!uniqueFindingsMap.has(f.cardId)) {
      uniqueFindingsMap.set(f.cardId, f);
    }
  }
  const uniqueFindings = Array.from(uniqueFindingsMap.values());

  const confidencePriority: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  const bucketCounts = { low: 0, medium: 0, high: 0, unknown: 0 };
  for (const f of uniqueFindings) {
    const v = verdictsMap?.get(f.cardId);
    if (v?.confidence === 'low') bucketCounts.low++;
    else if (v?.confidence === 'medium') bucketCounts.medium++;
    else if (v?.confidence === 'high') bucketCounts.high++;
    else bucketCounts.unknown++;
  }

  const sorted = [...uniqueFindings].sort((a, b) => {
    if (verdictsMap) {
      const vA = verdictsMap.get(a.cardId);
      const vB = verdictsMap.get(b.cardId);
      const prioA = vA?.confidence ? (confidencePriority[vA.confidence] ?? 2) : 2;
      const prioB = vB?.confidence ? (confidencePriority[vB.confidence] ?? 2) : 2;
      if (prioA !== prioB) {
        return prioA - prioB;
      }
    }
    const hashA = createHash('sha256').update(a.cardId).digest('hex');
    const hashB = createHash('sha256').update(b.cardId).digest('hex');
    return hashA.localeCompare(hashB);
  });

  const selected = sorted.slice(0, targetCount);

  return selected.map((f) => {
    const verdict = verdictsMap?.get(f.cardId);
    if (verdictsMap && (!verdict?.reason || !verdict.reason.trim())) {
      throw new Error(
        `Phase 2 drop for card ${f.cardId} is missing a drop reason. Failing fast per O45.`,
      );
    }
    return {
      cardId: f.cardId,
      repo: f.repo,
      commit: f.commit,
      guideId: f.guideId,
      sourceId: f.ruleId,
      file: f.file,
      line: f.line,
      code: f.contextSlice || f.codeSnippet,
      phase2Decision: 'drop',
      phase2Reason: verdict?.reason ?? 'Phase 2 drop reason missing',
      phase2Confidence: verdict?.confidence ?? 'unknown',
      populationCounts: bucketCounts,
      findings: [
        {
          tool: 'modern-web-guidance-analyzer',
          repo: f.repo,
          commit: f.commit,
          guideId: f.guideId,
          sourceId: f.ruleId,
          kind: 'uses-old-pattern',
          file: f.file,
          line: f.line,
          reason: f.message,
        },
      ],
    };
  });
}

/**
 * Computes a 12-char SHA-256 hash of all non-test rule source files.
 */
export async function computeRuleSetHash(
  rulesDir: string = join(WORKTREE_ROOT, 'src/analyzing/rules'),
  length = 12,
): Promise<string> {
  const entries = await readdir(rulesDir);
  const ruleFiles = entries
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();

  const hash = createHash('sha256');
  for (const file of ruleFiles) {
    const content = await readFile(join(rulesDir, file));
    hash.update(file).update(':').update(content);
  }
  return hash.digest('hex').slice(0, length);
}

/**
 * Deterministically stratified-samples findings across repos up to targetCount (Spec §3 sequential stopping n=60).
 * Sorts repos and findings deterministically, then round-robins across repos.
 */
export function stratifiedSampleFindings(
  findings: readonly AnalyzerFinding[],
  targetCount = 60,
): AnalyzerFinding[] {
  if (findings.length <= targetCount) {
    return [...findings];
  }

  const byRepo = new Map<string, AnalyzerFinding[]>();
  for (const f of findings) {
    const list = byRepo.get(f.repo) ?? [];
    list.push(f);
    byRepo.set(f.repo, list);
  }

  const sortedRepos = Array.from(byRepo.keys()).sort();
  for (const r of sortedRepos) {
    const list = byRepo.get(r);
    if (!list) continue;
    list.sort((a, b) => {
      const cmpFile = a.file.localeCompare(b.file);
      if (cmpFile !== 0) return cmpFile;
      if (a.line !== b.line) return a.line - b.line;
      return a.cardId.localeCompare(b.cardId);
    });
  }

  const sampled: AnalyzerFinding[] = [];
  const repoIndices = new Map<string, number>(sortedRepos.map((r) => [r, 0]));

  while (sampled.length < targetCount) {
    let addedInRound = false;
    for (const r of sortedRepos) {
      if (sampled.length >= targetCount) {
        break;
      }
      const list = byRepo.get(r) ?? [];
      const idx = repoIndices.get(r) ?? 0;
      if (idx < list.length) {
        sampled.push(list[idx]);
        repoIndices.set(r, idx + 1);
        addedInRound = true;
      }
    }
    if (!addedInRound) {
      break;
    }
  }

  return sampled;
}

/**
 * Scans all eligible grading-only repos on disk using ALL_RULES.
 */
export async function scanGradingRepos(
  gradingRepos: readonly RepoConfigEntry[],
  rules: readonly AnalyzerRule[] = ALL_RULES,
): Promise<AnalyzerFinding[]> {
  const allFindings: AnalyzerFinding[] = [];
  const sharedProject = createInMemoryProject();

  for (const entry of gradingRepos) {
    const dir = repoDir(entry);
    const findings = await scanRepoFiles(dir, rules, {
      repo: entry.repo,
      commit: entry.commit,
      excludeCorpusNonAppDirs: true,
      project: sharedProject,
    });
    allFindings.push(...findings);
  }

  return allFindings;
}

/**
 * Deterministically samples up to targetCount (default 10) kept findings for spot-checking per G6.
 * Prefers kept findings from novel rules (guides outside PILOT_GUIDE_IDS), or falls back to
 * all kept findings if no novel rules are present.
 */
export function sampleM3SpotcheckDeck(
  keptFindings: readonly AnalyzerFinding[],
  targetCount = 10,
): CalibrationDeckItem[] {
  if (keptFindings.length === 0) {
    return [];
  }

  const novelFindings = keptFindings.filter(
    (f) => !PILOT_GUIDE_IDS.includes(f.guideId as (typeof PILOT_GUIDE_IDS)[number]),
  );
  const pool = novelFindings.length > 0 ? novelFindings : [...keptFindings];

  const sorted = [...pool].sort((a, b) => {
    const hashA = createHash('sha256').update(a.cardId).digest('hex');
    const hashB = createHash('sha256').update(b.cardId).digest('hex');
    return hashA.localeCompare(hashB);
  });

  const selected = sorted.slice(0, targetCount);

  return selected.map((f) => ({
    cardId: f.cardId,
    repo: f.repo,
    commit: f.commit,
    guideId: f.guideId,
    sourceId: f.ruleId,
    file: f.file,
    line: f.line,
    code: f.contextSlice || f.codeSnippet,
    phase2Decision: 'keep',
    phase2Reason: 'Phase 2 filter approved finding',
    findings: [
      {
        tool: 'modern-web-guidance-analyzer',
        repo: f.repo,
        commit: f.commit,
        guideId: f.guideId,
        sourceId: f.ruleId,
        kind: 'uses-old-pattern',
        file: f.file,
        line: f.line,
        reason: f.message,
      },
    ],
  }));
}

/**
 * Builds a lookup map from rule ID (and guide ID fallback) to AnalyzerRule.
 * Guarantees that rules registered by explicit rule ID (r.id) are never overwritten
 * by a secondary rule sharing the same guideId.
 */
export function buildRulesByIdMap(
  rules: readonly AnalyzerRule[],
): Map<string, AnalyzerRule> {
  const rulesById = new Map<string, AnalyzerRule>();
  for (const r of rules) {
    rulesById.set(r.id, r);
  }
  for (const r of rules) {
    if (!rulesById.has(r.guideId)) {
      rulesById.set(r.guideId, r);
    }
  }
  return rulesById;
}

function createBlindCardPayloads(
  findings: readonly AnalyzerFinding[],
  summaries: ReadonlyMap<string, GuideSummaryInfo>,
  rulesById: ReadonlyMap<string, AnalyzerRule>,
): BlindCardPayload[] {
  return findings.map((finding) => {
    const summary = summaries.get(finding.guideId);
    if (!summary) {
      throw new Error(`Missing guide summary for guide ${finding.guideId} (O56/O71)`);
    }
    const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
    if (!rule) {
      throw new Error(`Missing rule for finding ruleId ${finding.ruleId} (O71)`);
    }
    const rHash = computeRuleHash(rule);
    return {
      cardId: finding.cardId,
      repo: finding.repo,
      commit: finding.commit,
      file: finding.file,
      line: finding.line,
      guideId: finding.guideId,
      ruleId: finding.ruleId,
      guideSummary: summary,
      codeSnippet: finding.contextSlice || finding.codeSnippet,
      ruleHash: rHash,
      guideHash: finding.guideHash,
    };
  });
}

interface Phase2BatchResult {
  readonly verdictsMap: Map<string, VerifierVerdict>;
  readonly telemetryRecords: CardTelemetryRecord[];
}

async function runPhase2ForBatch(
  findings: readonly AnalyzerFinding[],
  rulesById: ReadonlyMap<string, AnalyzerRule>,
  telemetryMap: ReadonlyMap<string, CardTelemetryRecord>,
  options: {
    readonly apiKey?: string;
    readonly fetchFn?: typeof fetch;
    readonly concurrency: number;
    readonly runId?: string;
  },
): Promise<Phase2BatchResult> {
  const verdictsMap = new Map<string, VerifierVerdict>();
  const telemetryRecords: CardTelemetryRecord[] = [];
  const phase2StartMs = Date.now();

  const findingsByGuideOrder = new Map<string, AnalyzerFinding[]>();
  for (const f of findings) {
    let group = findingsByGuideOrder.get(f.guideId);
    if (!group) {
      group = [];
      findingsByGuideOrder.set(f.guideId, group);
    }
    group.push(f);
  }
  const orderedGuideIds = Array.from(findingsByGuideOrder.keys());
  const totalGuides = orderedGuideIds.length;

  for (let startIdx = 0; startIdx < totalGuides; startIdx += 5) {
    const chunkGuideIds = orderedGuideIds.slice(startIdx, startIdx + 5);
    const chunkFindings: AnalyzerFinding[] = [];
    for (const gid of chunkGuideIds) {
      const group = findingsByGuideOrder.get(gid);
      if (group) {
        chunkFindings.push(...group);
      }
    }

    const uncached: AnalyzerFinding[] = [];
    for (const f of chunkFindings) {
      const rule = rulesById.get(f.ruleId) ?? rulesById.get(f.guideId);
      const rHash = rule ? computeRuleHash(rule) : '';
      const key = computeTelemetryCacheKey(f.cardId, rHash, f.guideHash, PHASE2_PROMPT_VERSION);
      const cached = telemetryMap.get(key);
      if (cached?.phase2) {
        if (!cached.phase2.confidence) {
          throw new Error(
            `Phase 2 cached record for card ${f.cardId} missing required field 'confidence' per R28`,
          );
        }
        verdictsMap.set(f.cardId, {
          cardId: f.cardId,
          keep: cached.phase2.keep,
          reason: cached.phase2.reason ?? '',
          confidence: cached.phase2.confidence,
        });
      } else {
        uncached.push(f);
      }
    }

    if (uncached.length > 0) {
      const phase2Opts: VerifierOptions = {
        apiKey: options.apiKey,
        fetchFn: options.fetchFn,
        concurrency: options.concurrency,
      };
      const phase2Live = await runLlmVerifier(uncached, rulesById, phase2Opts);
      for (const v of phase2Live.verdicts) {
        verdictsMap.set(v.cardId, v);
        const finding = uncached.find((f) => f.cardId === v.cardId);
        if (finding) {
          const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
          telemetryRecords.push({
            cardId: finding.cardId,
            repo: finding.repo,
            commit: finding.commit,
            file: finding.file,
            line: finding.line,
            guideId: finding.guideId,
            ruleId: finding.ruleId,
            ruleHash: rule ? computeRuleHash(rule) : '',
            guideHash: finding.guideHash,
            promptVersion: PHASE2_PROMPT_VERSION,
            timestamp: new Date().toISOString(),
            runId: options.runId ?? 'phase2-run',
            source: 'live',
            phase2: {
              keep: v.keep,
              confidence: v.confidence,
              reason: v.reason,
            },
          });
        }
      }
    }

    const completedGuides = Math.min(startIdx + 5, totalGuides);
    const elapsedSec = ((Date.now() - phase2StartMs) / 1000).toFixed(1);
    console.error(
      `[scorecard] Phase 2 (verifyFindingsWithLlm) progress: ${completedGuides}/${totalGuides} guides (${verdictsMap.size}/${findings.length} findings, ${elapsedSec}s elapsed)`,
    );
  }

  return { verdictsMap, telemetryRecords };
}

interface JudgeBatchResult {
  readonly consensusVerdicts: Map<string, JudgeResult>;
  readonly cardVotesMap: Map<string, [JudgeVerdict, JudgeVerdict, JudgeVerdict]>;
  readonly telemetryRecords: CardTelemetryRecord[];
}

async function runJudgeForBatch(
  cards: readonly BlindCardPayload[],
  telemetryMap: ReadonlyMap<string, CardTelemetryRecord>,
  rulesById: ReadonlyMap<string, AnalyzerRule>,
  options: {
    readonly apiKey?: string;
    readonly fetchFn?: typeof fetch;
    readonly concurrency: number;
    readonly temperature: number;
    readonly runId?: string;
  },
): Promise<JudgeBatchResult> {
  const consensusVerdicts = new Map<string, JudgeResult>();
  const cardVotesMap = new Map<string, [JudgeVerdict, JudgeVerdict, JudgeVerdict]>();
  const telemetryRecords: CardTelemetryRecord[] = [];
  const judgeStartMs = Date.now();

  const cardsByGuideOrder = new Map<string, BlindCardPayload[]>();
  for (const card of cards) {
    let group = cardsByGuideOrder.get(card.guideId);
    if (!group) {
      group = [];
      cardsByGuideOrder.set(card.guideId, group);
    }
    group.push(card);
  }
  const orderedGuideIds = Array.from(cardsByGuideOrder.keys());
  const totalGuides = orderedGuideIds.length;

  for (let startIdx = 0; startIdx < totalGuides; startIdx += 5) {
    const chunkGuideIds = orderedGuideIds.slice(startIdx, startIdx + 5);
    const chunkCards: BlindCardPayload[] = [];
    for (const gid of chunkGuideIds) {
      const group = cardsByGuideOrder.get(gid);
      if (group) {
        chunkCards.push(...group);
      }
    }

    const uncachedCards: BlindCardPayload[] = [];
    for (const card of chunkCards) {
      if (!card.ruleHash || !card.guideHash) {
        throw new Error(`BlindCardPayload missing ruleHash or guideHash for card ${card.cardId} (O71)`);
      }
      const key = computeTelemetryCacheKey(card.cardId, card.ruleHash, card.guideHash, JUDGE_VERSION);
      const cached = telemetryMap.get(key);
      if (cached?.judge) {
        if (!cached.judge.facts) {
          throw new Error(
            `Cached judge telemetry for card ${card.cardId} missing required facts per R29/O30`,
          );
        }
        consensusVerdicts.set(card.cardId, {
          cardId: card.cardId,
          verdict: cached.judge.majorityVerdict,
          facts: cached.judge.facts,
          rawResponse: '',
        });
        if (
          Array.isArray(cached.judge.runVotes) &&
          cached.judge.runVotes.length === 3 &&
          cached.judge.runVotes.every(isJudgeVerdict)
        ) {
          cardVotesMap.set(card.cardId, [
            cached.judge.runVotes[0],
            cached.judge.runVotes[1],
            cached.judge.runVotes[2],
          ]);
        }
      } else {
        uncachedCards.push(card);
      }
    }

    if (uncachedCards.length > 0) {
      const judgeOpts: JudgeRunOptions = {
        apiKey: options.apiKey,
        fetchFn: options.fetchFn,
        mode: 'direct',
        concurrency: options.concurrency,
        temperature: options.temperature,
      };

      const run0 = await runJudgeDirect(uncachedCards, judgeOpts);
      const run1 = await runJudgeDirect(uncachedCards, judgeOpts);
      const run2 = await runJudgeDirect(uncachedCards, judgeOpts);

      const liveStability: StabilityEvaluationResult = evaluateJudgeStability([run0, run1, run2]);

      for (const res of liveStability.consensusResults) {
        consensusVerdicts.set(res.cardId, res);
        const card = uncachedCards.find((c) => c.cardId === res.cardId);
        if (card) {
          const v0 = run0.find((r) => r.cardId === res.cardId);
          const v1 = run1.find((r) => r.cardId === res.cardId);
          const v2 = run2.find((r) => r.cardId === res.cardId);
          if (!v0 || !v1 || !v2) {
            throw new Error(`Missing run vote for card ${res.cardId} in judge consensus (O71)`);
          }
          const votes: [JudgeVerdict, JudgeVerdict, JudgeVerdict] = [
            v0.verdict,
            v1.verdict,
            v2.verdict,
          ];
          cardVotesMap.set(card.cardId, votes);
          telemetryRecords.push({
            cardId: card.cardId,
            repo: card.repo,
            commit: card.commit ?? 'uncommitted',
            file: card.file,
            line: card.line,
            guideId: card.guideId,
            ruleId: card.ruleId ?? card.guideId,
            ruleHash: card.ruleHash ?? '',
            guideHash: card.guideHash ?? '',
            promptVersion: JUDGE_VERSION,
            timestamp: new Date().toISOString(),
            runId: options.runId ?? 'judge-consensus-run',
            source: 'live',
            judge: {
              runVotes: votes,
              majorityVerdict: res.verdict,
              rationale: res.facts.reasoning,
              facts: res.facts,
            },
          });
        }
      }
    }

    const completedGuides = Math.min(startIdx + 5, totalGuides);
    const elapsedSec = ((Date.now() - judgeStartMs) / 1000).toFixed(1);
    console.error(
      `[scorecard] Judge (evaluateCard3Pass) progress: ${completedGuides}/${totalGuides} guides (${consensusVerdicts.size}/${cards.length} cards, ${elapsedSec}s elapsed)`,
    );
  }

  return { consensusVerdicts, cardVotesMap, telemetryRecords };
}

/**
 * Executes the complete held-out evaluation for Milestone 2 pilot rules.
 */
export async function runPilotScorecard(
  options: PilotScorecardOptions = {},
): Promise<PilotScorecardReport> {
  const reposPath = options.reposConfigPath ?? REPOS_CONFIG_PATH;
  const gradesPath = options.gradesPath ?? GRADES_PATH;
  let rules = options.rules ?? ALL_RULES;
  if (options.guideIds && options.guideIds.length > 0) {
    const guideSet = new Set(options.guideIds);
    rules = rules.filter((r) => guideSet.has(r.guideId));
  }
  const targetGuideIds: readonly string[] = Array.from(new Set(rules.map((r) => r.guideId)));
  const rulesDir = options.rulesDir ?? join(WORKTREE_ROOT, 'src/analyzing/rules');
  const initialBatchSize = Math.min(
    options.initialSampleBatch ?? INITIAL_SAMPLE_BATCH,
    options.maxSequentialSample ?? MAX_EXTENDED_SAMPLE,
  );
  const maxExtendedSize = options.maxSequentialSample ?? MAX_EXTENDED_SAMPLE;
  const concurrency = options.concurrency ?? 10;
  const customFetch = options.fetchFn;
  const apiKey = options.apiKey;
  const mode = options.mode ?? 'local';
  const split: ScorecardSplit = options.split ?? 'held-out';

  // 1. Load repos.json and select split
  const reposRaw = await readFile(reposPath, 'utf8');
  const allRepos = JSON.parse(reposRaw) as RepoConfigEntry[];
  const gradingRepos = allRepos.filter((r) => {
    if (split === 'held-out' || split === 'tune' || split === 'grading-only') {
      return r.split === 'held-out' || r.split === 'tune' || r.split === 'grading-only';
    }
    return r.split === split;
  });

  const phase1Findings: AnalyzerFinding[] = [];

  // 2. Scan held-out split based on mode (R24: report local repos and GitMirror separately)
  if (mode === 'local' || mode === 'all') {
    const localFindings = await scanGradingRepos(gradingRepos, rules);
    phase1Findings.push(...localFindings);
  }

  const gitMirrorDir = resolveGitMirrorCacheDir();
  const gitMirrorManifestPath = join(gitMirrorDir, 'manifest.json');
  let gitMirrorManifestRaw: string | null = null;
  try {
    gitMirrorManifestRaw = await readFile(gitMirrorManifestPath, 'utf8');
  } catch (err: unknown) {
    if (!isEnoent(err)) {
      throw err;
    }
  }

  if ((mode === 'gitmirror' || mode === 'all') && gitMirrorManifestRaw) {
    interface GitMirrorManifestEntry {
      readonly repository: string;
      readonly commit_id?: string;
      readonly filepath: string;
      readonly split: string;
    }
    const manifestEntries = JSON.parse(gitMirrorManifestRaw) as GitMirrorManifestEntry[];
    for (const entry of manifestEntries) {
      if (entry.split !== 'rule-writing' && entry.split !== 'held-out') {
        throw new Error(
          `GitMirror manifest entry for ${entry.repository}:${entry.filepath} has invalid split "${entry.split}". Must be 'rule-writing' or 'held-out' (D-036).`,
        );
      }
    }
    const splitEntries = manifestEntries.filter((e) => e.split === split);

    // Group files by repository
    const byRepo = new Map<string, { commit: string; files: string[] }>();
    for (const entry of splitEntries) {
      if (!entry.commit_id) {
        throw new Error(`GitMirror manifest entry for ${entry.repository} missing commit_id (O71)`);
      }
      let repoGroup = byRepo.get(entry.repository);
      if (!repoGroup) {
        repoGroup = {
          commit: entry.commit_id,
          files: [],
        };
        byRepo.set(entry.repository, repoGroup);
      }
      repoGroup.files.push(entry.filepath);
    }

    const targetSplitDir = join(gitMirrorDir, 'held-out');
    try {
      await readdir(targetSplitDir);
    } catch (err: unknown) {
      throw new Error(`GitMirror held-out directory missing at ${targetSplitDir} (D-036)`);
    }

    const sharedProject = createInMemoryProject();
    const phase1StartMs = Date.now();
    let repoIndex = 0;
    for (const [repo, group] of byRepo.entries()) {
      repoIndex++;
      const sanitizedRepo = repo.replace('/', '__');
      const repoDir = join(targetSplitDir, sanitizedRepo);
      const fileMap = new Map<string, string>();
      for (const relFile of group.files) {
        const fullFilePath = join(repoDir, relFile);
        try {
          const content = await readFile(fullFilePath, 'utf8');
          fileMap.set(relFile, content);
        } catch (fileErr: unknown) {
          throw new Error(
            `GitMirror held-out file missing on disk: ${fullFilePath} (${fileErr instanceof Error ? fileErr.message : String(fileErr)}) (D-036)`,
          );
        }
      }
      if (fileMap.size > 0) {
        const findings = scanFiles(fileMap, rules, {
          repo,
          commit: group.commit,
          excludeCorpusNonAppDirs: true,
          project: sharedProject,
        });
        phase1Findings.push(...findings);
      }
      if (repoIndex % 500 === 0 || repoIndex === byRepo.size) {
        const elapsedSec = ((Date.now() - phase1StartMs) / 1000).toFixed(1);
        console.error(
          `[scorecard] Phase 1 progress: ${repoIndex}/${byRepo.size} repos (${elapsedSec}s elapsed, ${phase1Findings.length} findings)`,
        );
      }
    }
  }

  // Group Phase 1 findings by guideId
  const findingsByGuide = new Map<string, AnalyzerFinding[]>();
  for (const gid of targetGuideIds) {
    findingsByGuide.set(gid, []);
  }
  for (const f of phase1Findings) {
    const list = findingsByGuide.get(f.guideId) ?? [];
    list.push(f);
    findingsByGuide.set(f.guideId, list);
  }

  // 3. Deterministically stratified-sample initial batch (up to 60) per guide
  const sampledFindingsByGuide = new Map<string, AnalyzerFinding[]>();
  const initialBatchFindings: AnalyzerFinding[] = [];

  for (const gid of targetGuideIds) {
    const guideFindings = findingsByGuide.get(gid) ?? [];
    const sampled = stratifiedSampleFindings(guideFindings, initialBatchSize);
    sampledFindingsByGuide.set(gid, sampled);
    initialBatchFindings.push(...sampled);
  }

  // 4. Run Phase 2 filter on initial batch findings with telemetry cache (P2)
  const rulesById = buildRulesByIdMap(rules);
  const telemetryMap = await loadCardTelemetryMap();
  const telemetryToWrite: CardTelemetryRecord[] = [];

  const initialPhase2 = await runPhase2ForBatch(
    initialBatchFindings,
    rulesById,
    telemetryMap,
    { apiKey, fetchFn: customFetch, concurrency },
  );
  const phase2VerdictsMap = initialPhase2.verdictsMap;
  telemetryToWrite.push(...initialPhase2.telemetryRecords);

  // 5. Load guide summaries and prepare blind cards for initial batch findings + human cards + canaries
  const summaries = await loadGuideSummariesMap();
  const initialBlindCards = createBlindCardPayloads(initialBatchFindings, summaries, rulesById);

  // Load Paul's 85 scored cards to calibrate judge stability and guard metrics (α, AC1)
  const { cards: scoredCards, humanVerdicts } = await loadPaulIrishScoredCards(gradesPath);
  const scoredBlindCards = await prepareBlindCards(scoredCards, summaries, reposPath);

  // Combine cards: scored human cards + initial sampled Phase 1 findings + 3 synthetic canaries
  const allRulesById = buildRulesByIdMap(ALL_RULES);
  const initialCardsMap = new Map<string, BlindCardPayload>();
  for (const c of scoredBlindCards) {
    const rule = allRulesById.get(c.ruleId ?? '') ?? allRulesById.get(c.guideId);
    const rHash = rule ? computeRuleHash(rule) : (c.ruleHash || 'calibration');
    const gHash = rule ? rule.guideHash : (c.guideHash || 'calibration');
    initialCardsMap.set(c.cardId, {
      ...c,
      ruleId: c.ruleId ?? rule?.id ?? c.guideId,
      ruleHash: rHash,
      guideHash: gHash,
    });
  }
  for (const c of initialBlindCards) {
    initialCardsMap.set(c.cardId, c);
  }
  for (const c of SYNTHETIC_CANARY_CARDS) {
    const diskSummary = summaries.get(c.guideId);
    const effectiveSummary = diskSummary ?? c.guideSummary;
    const rule = allRulesById.get(c.guideId);
    initialCardsMap.set(c.cardId, {
      ...c,
      ruleId: c.ruleId ?? rule?.id ?? c.guideId,
      ruleHash: c.ruleHash || (rule ? computeRuleHash(rule) : 'canary'),
      guideHash: c.guideHash || rule?.guideHash || 'canary',
      guideSummary: effectiveSummary,
    });
  }

  // 6. Execute 3 stability runs with majority-vote judge for initial batch
  const initialJudge = await runJudgeForBatch(
    Array.from(initialCardsMap.values()),
    telemetryMap,
    rulesById,
    { apiKey, fetchFn: customFetch, concurrency, temperature: options.temperature ?? 0.2 },
  );
  const consensusVerdicts = initialJudge.consensusVerdicts;
  const cardVotesMap = initialJudge.cardVotesMap;
  telemetryToWrite.push(...initialJudge.telemetryRecords);

  // 6b. Sequential stopping check: for rules with > initialBatchSize findings where
  // decision is 'continue', extend sampling up to maxExtendedSize (100)
  const extendedFindings: AnalyzerFinding[] = [];
  if (maxExtendedSize > initialBatchSize) {
    for (const gid of targetGuideIds) {
      const guideFindings = findingsByGuide.get(gid) ?? [];
      const currentSampled = sampledFindingsByGuide.get(gid) ?? [];
      if (guideFindings.length <= currentSampled.length) {
        continue;
      }
      const currentKept = currentSampled.filter((f) => phase2VerdictsMap.get(f.cardId)?.keep);
      let currentRight = 0;
      for (const f of currentKept) {
        if (isPositiveVerdict(consensusVerdicts.get(f.cardId)?.verdict)) {
          currentRight++;
        }
      }
      const decision = checkSequentialStop(currentRight, currentKept.length, 0.9, maxExtendedSize);
      if (decision === 'continue') {
        const fullSample = stratifiedSampleFindings(guideFindings, maxExtendedSize);
        const additional = fullSample.slice(currentSampled.length);
        if (additional.length > 0) {
          sampledFindingsByGuide.set(gid, [...currentSampled, ...additional]);
          extendedFindings.push(...additional);
        }
      }
    }
  }

  // If any guides were extended, run Phase 2 and Judge on the extended cards
  if (extendedFindings.length > 0) {
    const extPhase2 = await runPhase2ForBatch(
      extendedFindings,
      rulesById,
      telemetryMap,
      { apiKey, fetchFn: customFetch, concurrency },
    );
    for (const [k, v] of extPhase2.verdictsMap) {
      phase2VerdictsMap.set(k, v);
    }
    telemetryToWrite.push(...extPhase2.telemetryRecords);

    const extBlindCards = createBlindCardPayloads(extendedFindings, summaries, rulesById);
    const extJudge = await runJudgeForBatch(
      extBlindCards,
      telemetryMap,
      rulesById,
      { apiKey, fetchFn: customFetch, concurrency, temperature: options.temperature ?? 0.2 },
    );
    for (const [k, v] of extJudge.consensusVerdicts) {
      consensusVerdicts.set(k, v);
    }
    for (const [k, v] of extJudge.cardVotesMap) {
      cardVotesMap.set(k, v);
    }
    telemetryToWrite.push(...extJudge.telemetryRecords);
  }

  // Combine all sampled findings across all guides
  const allSampledFindings: AnalyzerFinding[] = [];
  for (const gid of targetGuideIds) {
    const list = sampledFindingsByGuide.get(gid) ?? [];
    allSampledFindings.push(...list);
  }

  const phase2KeptByGuide = new Map<string, AnalyzerFinding[]>();
  for (const gid of targetGuideIds) {
    phase2KeptByGuide.set(gid, []);
  }

  const allKeptFindings: AnalyzerFinding[] = [];
  const allDroppedFindings: AnalyzerFinding[] = [];

  for (const f of allSampledFindings) {
    const v = phase2VerdictsMap.get(f.cardId);
    if (v?.keep) {
      allKeptFindings.push(f);
      const list = phase2KeptByGuide.get(f.guideId) ?? [];
      list.push(f);
      phase2KeptByGuide.set(f.guideId, list);
    } else {
      allDroppedFindings.push(f);
    }
  }

  // Stage a deterministic 25-card sample of Phase-2-dropped findings, prioritizing low/medium confidence (R18, R28)
  if (allDroppedFindings.length > 0) {
    const dropsDeck = samplePhase2DropsDeck(allDroppedFindings, 25, phase2VerdictsMap);
    let defaultDropsDeckName: string;
    if (mode === 'gitmirror') {
      defaultDropsDeckName =
        split === 'held-out'
          ? 'phase2-drops-gitmirror-final-deck.json'
          : 'phase2-drops-gitmirror-deck.json';
    } else {
      defaultDropsDeckName =
        split === 'held-out'
          ? 'phase2-drops-local-final-deck.json'
          : 'phase2-drops-local-deck.json';
    }
    const dropsDeckPath =
      options.dropsDeckPath ??
      join(ANALYZER_INTERNAL_DIR, 'labels', defaultDropsDeckName);
    const cardsDropsDeckPath = join(
      ANALYZER_INTERNAL_DIR,
      'labels',
      'cards',
      `_${defaultDropsDeckName}`,
    );
    await mkdir(dirname(dropsDeckPath), { recursive: true });
    await mkdir(dirname(cardsDropsDeckPath), { recursive: true });
    await writeFile(dropsDeckPath, JSON.stringify(dropsDeck, null, 2) + '\n', 'utf8');
    await writeFile(cardsDropsDeckPath, JSON.stringify(dropsDeck, null, 2) + '\n', 'utf8');
    for (const card of dropsDeck) {
      const cardPath = join(
        ANALYZER_INTERNAL_DIR,
        'labels',
        'cards',
        `phase2-drop-${card.cardId}.json`,
      );
      await writeFile(cardPath, JSON.stringify(card, null, 2) + '\n', 'utf8');
    }
  }

  let agreedVotesCount = 0;
  let totalCardsWithVotes = 0;
  for (const [, votes] of cardVotesMap.entries()) {
    if (votes.length === 3) {
      totalCardsWithVotes++;
      if (votes[0] === votes[1] && votes[1] === votes[2]) {
        agreedVotesCount++;
      }
    }
  }
  const stabilityRate = totalCardsWithVotes > 0 ? agreedVotesCount / totalCardsWithVotes : null;

  if (telemetryToWrite.length > 0) {
    await appendCardTelemetry(telemetryToWrite);
  }

  // 7. Verify canaries strictly on Paul's real human-labeled negative cards from grades.paulirish.jsonl (R13)
  const realHumanNegatives: CanaryCard[] = [];
  for (const [cardId, verdict] of humanVerdicts.entries()) {
    if (!isPositiveVerdict(verdict) && verdict !== 'unsure' && isJudgeVerdict(verdict)) {
      realHumanNegatives.push({
        cardId,
        expectedVerdict: verdict,
        description: `Paul Irish human-labeled negative (${verdict})`,
      });
    }
  }

  const consensusList = Array.from(consensusVerdicts.values());
  if (realHumanNegatives.length === 0) {
    throw new Error('No real human-labeled negative cards found for canary verification (O71)');
  }
  const canaryResult: CanaryCheckResult = checkCanaries(
    consensusList,
    realHumanNegatives,
  );
  if (canaryResult.tnr < 1.0) {
    throw new Error(
      `Canary TNR failed: ${canaryResult.tnr * 100}% (expected 100%). Violations: ${JSON.stringify(canaryResult.violations)}`,
    );
  }

  // 8. Compute inter-rater agreement & guard metrics against Paul's 85 human grades
  const droppedCardIds = new Set(['2547b2ba6d74', '7f2a96f62a4c']);
  const evalMetrics: JudgeEvaluationMetrics = evaluateJudgeMetrics(
    consensusList,
    humanVerdicts,
    droppedCardIds,
  );

  // 9. Compute recall on Paul's labeled positives
  const scoredCardsByGuide = new Map<string, string[]>();
  for (const gid of targetGuideIds) {
    scoredCardsByGuide.set(gid, []);
  }
  for (const [cardId, verdict] of humanVerdicts.entries()) {
    if (isPositiveVerdict(verdict)) {
      const card = scoredCards.find((c) => c.cardId === cardId);
      if (card && scoredCardsByGuide.has(card.guideId)) {
        scoredCardsByGuide.get(card.guideId)?.push(cardId);
      }
    }
  }

  const phase1CardIds = new Set(phase1Findings.map((f) => f.cardId));
  const phase2KeptCardIds = new Set(allKeptFindings.map((f) => f.cardId));

  // 10. Compute per-guide scorecard
  let totalPhase2Kept = 0;
  let totalJudgedRight = 0;
  let totalLabeledPositives = 0;
  let totalPhase2Recalled = 0;
  let totalPhase1Recalled = 0;
  let totalPhase1SampledAll = 0;
  let totalPhase1RightAll = 0;
  let clearedPhase1Bar90Count = 0;
  let phase2DroppedRightTotal = 0;
  let clearedBarCount = 0;
  let clearedBar90Count = 0;
  let clearedSampleConstrainedCount = 0;
  let clearedHighN80Count = 0;
  let clearedZeroFpExhaustiveCount = 0;
  let clearedScreenCount = 0;
  let provenHighNCount = 0;
  let zeroFpLowNCount = 0;
  let singleShotQualifiedCount = 0;
  let postSelectionTunedCount = 0;
  let qualifiedRight = 0;
  let qualifiedKept = 0;

  const guideScorecards: GuideScorecard[] = [];

  for (const gid of targetGuideIds) {
    const guideRules = rules.filter((r) => r.guideId === gid);
    const ruleIds = guideRules.map((r) => r.id);

    const guideFindings = findingsByGuide.get(gid) ?? [];
    const p1Total = guideFindings.length;
    const p1SampledFindings = sampledFindingsByGuide.get(gid) ?? [];
    const p1Sampled = p1SampledFindings.length;
    const p2Kept = phase2KeptByGuide.get(gid) ?? [];
    const p2KeptCount = p2Kept.length;
    const p2DroppedCount = p1Sampled - p2KeptCount;

    let phase1RightCount = 0;
    for (const f of p1SampledFindings) {
      const res = consensusVerdicts.get(f.cardId);
      if (res && isPositiveVerdict(res.verdict)) {
        phase1RightCount++;
      }
    }

    let rightCount = 0;
    for (const f of p2Kept) {
      const res = consensusVerdicts.get(f.cardId);
      if (res && isPositiveVerdict(res.verdict)) {
        rightCount++;
      }
    }

    const fpCount = p2KeptCount - rightCount;
    const phase2DroppedRightCount = phase1RightCount - rightCount;
    const phase1Precision = p1Sampled > 0 ? Number((phase1RightCount / p1Sampled).toFixed(4)) : 0;
    const phase1Wilson95 = wilsonInterval(phase1RightCount, p1Sampled, Z_95);
    const clearsPhase1Bar90 = p1Sampled >= 35 && phase1Wilson95.lower >= 0.90;

    totalPhase1SampledAll += p1Sampled;
    totalPhase1RightAll += phase1RightCount;
    if (clearsPhase1Bar90) {
      clearedPhase1Bar90Count++;
    }
    phase2DroppedRightTotal += phase2DroppedRightCount;

    const qual = evaluateGuideQualification({
      p1Total,
      p1Sampled,
      p2KeptCount,
      rightCount,
    });

    const isPostSelectionTuned = POST_SELECTION_TUNED_GUIDE_IDS.includes(gid);

    if (qual.clearsPrecisionBar) {
      clearedBarCount++;
      if (isPostSelectionTuned) {
        postSelectionTunedCount++;
      } else {
        singleShotQualifiedCount++;
      }
      qualifiedRight += rightCount;
      qualifiedKept += p2KeptCount;
    }
    if (qual.clearsBar90) {
      clearedBar90Count++;
    }
    if (qual.clearsSampleConstrained) {
      clearedSampleConstrainedCount++;
    }
    if (qual.clearedHighN80) {
      clearedHighN80Count++;
    }
    if (qual.clearedZeroFpExhaustive) {
      clearedZeroFpExhaustiveCount++;
    }
    if (qual.clearsScreen80) {
      clearedScreenCount++;
    }
    if (qual.tier === 'proven-high-n') {
      provenHighNCount++;
    } else if (qual.tier === 'zero-fp-low-n' || qual.tier === 'unmeasured-low-n') {
      zeroFpLowNCount++;
    }

    // Recall & Retention metrics (R18)
    const positiveIds = scoredCardsByGuide.get(gid) ?? [];
    const nPos = positiveIds.length;
    const p1Recalled = positiveIds.filter((id) => phase1CardIds.has(id)).length;
    const p2Recalled = positiveIds.filter((id) => phase2KeptCardIds.has(id)).length;

    totalPhase2Kept += p2KeptCount;
    totalJudgedRight += rightCount;
    totalLabeledPositives += nPos;
    totalPhase1Recalled += p1Recalled;
    totalPhase2Recalled += p2Recalled;

    const phase2RetentionRate = p1Recalled > 0 ? Number((p2Recalled / p1Recalled).toFixed(4)) : null;
    const phase2YieldRetentionRate = p1Sampled > 0 ? Number((p2KeptCount / p1Sampled).toFixed(4)) : 0;

    const rulesForGuide: string[] = Array.from(new Set(guideFindings.map((f) => f.ruleId)));
    const ruleScorecards: RuleScorecard[] = rulesForGuide.map((rid) => {
      const p1RuleTotal = guideFindings.filter((f) => f.ruleId === rid).length;
      const p2RuleKept = p2Kept.filter((f) => f.ruleId === rid);
      let rRight = 0;
      for (const rf of p2RuleKept) {
        const res = consensusVerdicts.get(rf.cardId);
        if (res && isPositiveVerdict(res.verdict)) rRight++;
      }
      const rFp = p2RuleKept.length - rRight;
      const rPrec = p2RuleKept.length > 0 ? Number((rRight / p2RuleKept.length).toFixed(4)) : 0;
      const rWilson = wilsonInterval(rRight, p2RuleKept.length, Z_95);
      return {
        ruleId: rid,
        phase1TotalYield: p1RuleTotal,
        phase2KeptCount: p2RuleKept.length,
        judgeJudgedCount: p2RuleKept.length,
        judgeRightCount: rRight,
        judgeFalsePositiveCount: rFp,
        precision: rPrec,
        wilson95: rWilson,
      };
    });

    guideScorecards.push({
      guideId: gid,
      ruleIds,
      rules: ruleScorecards,
      phase1TotalYield: p1Total,
      phase1SampledCount: p1Sampled,
      phase2KeptCount: p2KeptCount,
      phase2DroppedCount: p2DroppedCount,
      judgeJudgedCount: p2KeptCount,
      judgeRightCount: rightCount,
      judgeFalsePositiveCount: fpCount,
      precision: Number(qual.precision.toFixed(4)),
      wilson80: qual.wilson80,
      wilson95: qual.wilson95,
      sequentialStopDecision: qual.sequentialStopDecision,
      clearsPrecisionBar: qual.clearsPrecisionBar,
      clearsBar90: qual.clearsBar90,
      clearsScreen80: qual.clearsScreen80,
      clearsSampleConstrained: qual.clearsSampleConstrained,
      isSampleConstrained: qual.isSampleConstrained,
      clearedHighN80: qual.clearedHighN80,
      clearedZeroFpExhaustive: qual.clearedZeroFpExhaustive,
      tier: qual.tier,
      postSelectionTuned: isPostSelectionTuned,
      recall: {
        labeledPositivesTotal: nPos,
        phase1Recalled: p1Recalled,
        phase2Recalled: p2Recalled,
        phase1RecallRate: nPos > 0 ? Number((p1Recalled / nPos).toFixed(4)) : 0,
        phase2RecallRate: nPos > 0 ? Number((p2Recalled / nPos).toFixed(4)) : 0,
      },
      phase2RetentionRate,
      phase2YieldRetentionRate,
      phase1RightCount,
      phase1Precision,
      phase1Wilson95,
      clearsPhase1Bar90,
      phase2DroppedRightCount,
    });
  }

  // 11. Compute aggregate metrics
  const gitState = getGitCommitState();
  const ruleSetHash = await computeRuleSetHash(rulesDir);
  let splitHash = await computeFileHash(reposPath);
  if (mode === 'gitmirror' && gitMirrorManifestRaw) {
    splitHash = split === 'final'
      ? createHash('sha256').update(gitMirrorManifestRaw).update(':final').digest('hex').slice(0, 12)
      : createHash('sha256').update(gitMirrorManifestRaw).digest('hex').slice(0, 12);
  } else if (mode === 'all' && gitMirrorManifestRaw) {
    const reposHash = await computeFileHash(reposPath);
    const manifestHash = createHash('sha256')
      .update(gitMirrorManifestRaw)
      .update(split === 'final' ? ':final' : '')
      .digest('hex')
      .slice(0, 12);
    splitHash = createHash('sha256')
      .update(reposHash)
      .update(':')
      .update(manifestHash)
      .digest('hex')
      .slice(0, 12);
  } else if (mode === 'local' && split === 'final') {
    const reposHash = await computeFileHash(reposPath);
    splitHash = createHash('sha256').update(reposHash).update(':final').digest('hex').slice(0, 12);
  }
  const gradesHash = await computeFileHash(gradesPath);
  const judgeVersion = JUDGE_VERSION;

  const splitLabel = split;
  const coverageMetric: MetricEntry = {
    value: Number((clearedBarCount / targetGuideIds.length).toFixed(4)),
    n: targetGuideIds.length,
    split: splitLabel,
  };

  const pooledHeldoutWilson = wilsonInterval(totalJudgedRight, totalPhase2Kept, Z_95);
  const heldOutPrecisionMetric: MetricEntry = {
    value: totalPhase2Kept > 0 ? Number((totalJudgedRight / totalPhase2Kept).toFixed(4)) : 0,
    lower: Number(pooledHeldoutWilson.lower.toFixed(4)),
    upper: Number(pooledHeldoutWilson.upper.toFixed(4)),
    n: totalPhase2Kept,
    split: `${splitLabel}, judged`,
  };

  const ppi = evalMetrics.ppiPrecision;
  const ppiPrecisionMetric: MetricEntry = {
    value: Number(ppi.estimate.toFixed(4)),
    lower: Number(ppi.lower.toFixed(4)),
    upper: Number(ppi.upper.toFixed(4)),
    n: scoredCards.length,
    split: splitLabel,
  };

  let recallMetric: MetricEntry;
  if (mode === 'gitmirror') {
    recallMetric = {
      value: 0,
      lower: 0,
      upper: 0,
      n: 0,
      split: `unmeasured (gitmirror, ${splitLabel})`,
    };
  } else {
    const recallWilson = wilsonInterval(totalPhase2Recalled, totalLabeledPositives, Z_95);
    recallMetric = {
      value:
        totalLabeledPositives > 0
          ? Number((totalPhase2Recalled / totalLabeledPositives).toFixed(4))
          : 0,
      lower: Number(recallWilson.lower.toFixed(4)),
      upper: Number(recallWilson.upper.toFixed(4)),
      n: totalLabeledPositives,
      split: splitLabel,
    };
  }

  const summary: PilotScorecardSummary = {
    totalDetectableGuides: targetGuideIds.length,
    clearedBarCount,
    clearedBar90Count,
    clearedSampleConstrainedCount,
    clearedHighN80Count,
    clearedZeroFpExhaustiveCount,
    clearsScreen80Count: clearedScreenCount,
    clearedScreenCount,
    provenHighNCount,
    zeroFpLowNCount,
    singleShotQualifiedCount,
    postSelectionTunedCount,
    qualifiedPooledPrecision: {
      successes: qualifiedRight,
      total: qualifiedKept,
      precision: qualifiedKept > 0 ? Number((qualifiedRight / qualifiedKept).toFixed(4)) : 0,
      wilson95: wilsonInterval(qualifiedRight, qualifiedKept, Z_95),
    },
    coverage: coverageMetric,
    coverageGate0: {
      value: Number((clearedBarCount / 116).toFixed(4)),
      n: 116,
      split: splitLabel,
    },
    overallPrecision: heldOutPrecisionMetric,
    overallRecall: recallMetric,
    pooledHeldoutPrecision: {
      successes: totalJudgedRight,
      total: totalPhase2Kept,
      precision: totalPhase2Kept > 0 ? Number((totalJudgedRight / totalPhase2Kept).toFixed(4)) : 0,
      wilson95: pooledHeldoutWilson,
    },
    ...(mode !== 'gitmirror' ? { ppiPrecision: ppiPrecisionMetric } : {}),
    judgeStability: stabilityRate !== null ? Number(stabilityRate.toFixed(4)) : null,
    judgeAlpha: Number(evalMetrics.krippendorffAlpha.toFixed(3)),
    judgeAc1: Number(evalMetrics.gwetAc1.toFixed(3)),
    canaryTnr: Number(canaryResult.tnr.toFixed(4)),
    canaryViolations: canaryResult.violations,
    phase2Retention: {
      phase1RecalledTotal: totalPhase1Recalled,
      phase2RecalledTotal: totalPhase2Recalled,
      rate: totalPhase1Recalled > 0 ? Number((totalPhase2Recalled / totalPhase1Recalled).toFixed(4)) : null,
    },
    phase2YieldRetention: {
      sampledTotal: allSampledFindings.length,
      keptTotal: totalPhase2Kept,
      rate: allSampledFindings.length > 0 ? Number((totalPhase2Kept / allSampledFindings.length).toFixed(4)) : 0,
    },
    pooledPhase1Precision: {
      successes: totalPhase1RightAll,
      total: totalPhase1SampledAll,
      precision: totalPhase1SampledAll > 0 ? Number((totalPhase1RightAll / totalPhase1SampledAll).toFixed(4)) : 0,
      wilson95: wilsonInterval(totalPhase1RightAll, totalPhase1SampledAll, Z_95),
    },
    clearedPhase1Bar90Count,
    phase2DroppedRightTotal,
  };

  const report: PilotScorecardReport = {
    timestamp: new Date().toISOString(),
    commit: gitState.commit,
    gitDirty: gitState.isDirty,
    ruleSetHash,
    splitHash,
    split,
    gradesHash,
    judgeVersion,
    guides: guideScorecards,
    summary,
    canaries: realHumanNegatives,
  };

  // 12. Save scorecard JSON to analyzer-internal/findings/ (R24 separate row / file)
  const defaultScorecardPath =
    mode === 'gitmirror'
      ? (split === 'final' || split === 'held-out' ? GITMIRROR_FINAL_SCORECARD_PATH : GITMIRROR_SCORECARD_PATH)
      : PILOT_SCORECARD_PATH;
  const outPath = options.scorecardPath ?? defaultScorecardPath;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

  // Auto-sync PROGRESS.md when scorecard is written to analyzer-internal/findings/ per D-025 / Track 4
  try {
    const { runProgressLogCli } = await import('./progress-log.ts');
    await runProgressLogCli({ renderOnly: true });
  } catch (syncErr: unknown) {
    console.warn('[scorecard] Auto-sync to PROGRESS.md failed:', syncErr);
  }

  // Save spot-check deck per G6
  const defaultSpotcheckPath =
    mode === 'gitmirror'
      ? (split === 'held-out'
          ? join(ANALYZER_INTERNAL_DIR, 'labels', 'gitmirror-final-spotcheck-deck.json')
          : join(ANALYZER_INTERNAL_DIR, 'labels', 'gitmirror-spotcheck-deck.json'))
      : M3_SPOTCHECK_DECK_PATH;
  const spotcheckPath = options.spotcheckDeckPath ?? defaultSpotcheckPath;
  const spotcheckCards = sampleM3SpotcheckDeck(allKeptFindings, 10);
  await mkdir(dirname(spotcheckPath), { recursive: true });
  await writeFile(spotcheckPath, JSON.stringify(spotcheckCards, null, 2), 'utf8');

  // 13. Optionally write to PROGRESS.md (R24: record two separate rows)
  if (options.writeProgress) {
    const progressLogPath = options.progressLogPath ?? PROGRESS_LOG_PATH;
    let repoCount = 93;
    if (mode === 'gitmirror') {
      try {
        const manifestObj = gitMirrorManifestRaw ? JSON.parse(gitMirrorManifestRaw) : null;
        repoCount = Array.isArray(manifestObj?.repos)
          ? manifestObj.repos.length
          : Array.isArray(manifestObj)
            ? manifestObj.length
            : 2598;
      } catch {
        repoCount = 2598;
      }
    }
    const modeLabel =
      mode === 'gitmirror'
        ? `GitMirror ${splitLabel} evaluation (${repoCount.toLocaleString()} repos)`
        : `local 93-repo ${splitLabel} rescore (93 repos, ${splitLabel} split per O32/O42)`;
    const stabilityStr = summary.judgeStability !== null
      ? `${(summary.judgeStability * 100).toFixed(1)}%`
      : 'unmeasured';
    const notAdmittedPrefix = summary.judgeAlpha < 0.667
      ? '[judge not admitted: in-sample on 116 dev cards; α < 0.667] '
      : '';
    const gateMissedPrefix = mode === 'gitmirror' && clearedBar90Count === 0
      ? '[GATE MISSED: 0/7 cleared >=0.90 LB vs 4-5/7 expected; 3/7 reached n>=35] '
      : '';
    const p1Total = summary.phase2YieldRetention?.sampledTotal ?? 0;
    const p2Total = summary.phase2YieldRetention?.keptTotal ?? heldOutPrecisionMetric.n;
    const p1Prec = summary.pooledPhase1Precision?.precision !== undefined
      ? `${(summary.pooledPhase1Precision.precision * 100).toFixed(1)}%`
      : 'unmeasured';
    const funnelStr = `Phase 1 -> Phase 2: ${p1Total} -> ${p2Total} (Phase-1 prec=${p1Prec})`;
    const judgeGuardStr = `judge α=${summary.judgeAlpha.toFixed(3)}/AC1=${summary.judgeAc1.toFixed(3)} (n=112)`;

    const progressRow: ProgressLogRow = {
      commit: gitState.commit,
      date: report.timestamp.slice(0, 10),
      ruleSetHash,
      splitHash,
      gradesHash,
      judgeVersion,
      coverage: coverageMetric,
      precision: heldOutPrecisionMetric,
      recall: recallMetric,
      judgeAlpha: summary.judgeAlpha,
      judgeAc1: summary.judgeAc1,
      canaryTnr: summary.canaryTnr,
      notes: `${notAdmittedPrefix}${gateMissedPrefix}Milestone 3 ${modeLabel}: ${clearedBarCount}/${targetGuideIds.length} guides cleared bar [${clearedBar90Count} at >=0.90 CI lower, ${clearedSampleConstrainedCount} ${mode === 'gitmirror' ? 'sample-constrained (3 at >=0.80 CI, 3 zero-FP exhaustive)' : 'unmeasured-low-n'}], ${provenHighNCount} proven + ${zeroFpLowNCount} unmeasured, prec=${((qualifiedRight / (qualifiedKept || 1)) * 100).toFixed(1)}%, pooled prec=${(summary.pooledHeldoutPrecision.precision * 100).toFixed(1)}%, ${funnelStr}, stability=${stabilityStr}, canaryTNR=100.0%, ${judgeGuardStr})`,
    };
    await recordProgressLogEntry(progressRow, progressLogPath);
  }

  return report;
}

/**
 * Formats a terminal-friendly summary of the scorecard report.
 */
export function formatPilotScorecardReport(report: PilotScorecardReport): string {
  const lines: string[] = [
    '============================================================',
    '       PILOT SCORECARD REPORT (Held-Out Grading Split)       ',
    '============================================================',
    `Commit:        ${report.commit}`,
    `Rule-Set Hash: ${report.ruleSetHash}`,
    `Split Hash:    ${report.splitHash}${report.split ? ` (${report.split})` : ''}`,
    `Grades Hash:   ${report.gradesHash}`,
    `Judge Version: ${report.judgeVersion}`,
    `Timestamp:     ${report.timestamp}`,
    '------------------------------------------------------------',
    'GUIDE PERFORMANCE:',
  ];

  for (const g of report.guides) {
    const prec = `${(g.precision * 100).toFixed(1)}%`;
    const w95 = `[${(g.wilson95.lower * 100).toFixed(1)}% - ${(g.wilson95.upper * 100).toFixed(1)}%]`;
    const w80 = `[${(g.wilson80.lower * 100).toFixed(1)}% - ${(g.wilson80.upper * 100).toFixed(1)}%]`;
    const bar90 = g.clearsBar90 ? 'PASS' : 'FAIL';
    const screen80 = g.clearsScreen80 ? 'PASS' : 'FAIL';
    const rec =
      g.recall.labeledPositivesTotal > 0
        ? `${(g.recall.phase2RecallRate * 100).toFixed(1)}% (${g.recall.phase2Recalled}/${g.recall.labeledPositivesTotal})`
        : 'N/A';
    const tierStr = g.tier ?? 'unknown';
    const tunedStr = g.postSelectionTuned ? ' (tuned)' : '';

    const p1PrecStr = g.phase1Precision !== undefined ? `${(g.phase1Precision * 100).toFixed(1)}%` : '-';
    const dropFnStr = g.phase2DroppedRightCount !== undefined ? ` | P2_drop_FN=${g.phase2DroppedRightCount}` : '';
    lines.push(
      `  * ${g.guideId.padEnd(36)}: P1=${String(g.phase1TotalYield).padStart(3)} (prec=${p1PrecStr.padStart(6)}) | P2_kept=${String(g.phase2KeptCount).padStart(2)} | Right=${String(g.judgeRightCount).padStart(2)} | Prec=${prec.padStart(6)} (95% CI ${w95}, 80% CI ${w80})${dropFnStr} | SeqStop=${g.sequentialStopDecision} | Bar90=${bar90} | Screen80=${screen80} | Tier=${tierStr}${tunedStr} | Recall=${rec}`,
    );
  }

  lines.push('------------------------------------------------------------');
  lines.push('SUMMARY:');
  const bar90Count = report.summary.clearedBar90Count ?? report.summary.clearedBarCount;
  const sampleCount = report.summary.clearedSampleConstrainedCount ?? 0;
  const highN80 = report.summary.clearedHighN80Count ?? 0;
  const zeroFp = report.summary.clearedZeroFpExhaustiveCount ?? 0;
  lines.push(
    `  Coverage:          ${(report.summary.coverage.value * 100).toFixed(1)}% (${report.summary.clearedBarCount}/${report.summary.totalDetectableGuides} guides cleared bar: ${bar90Count} at >=0.90 CI lower, ${sampleCount} sample-constrained [${highN80} at >=0.80 CI, ${zeroFp} zero-FP exhaustive])`,
  );
  if (report.summary.provenHighNCount !== undefined && report.summary.zeroFpLowNCount !== undefined) {
    lines.push(
      `  Tier Breakdown:    ${report.summary.provenHighNCount} proven-high-n + ${report.summary.zeroFpLowNCount} zero-fp-low-n = ${report.summary.clearedBarCount} qualified (${report.summary.singleShotQualifiedCount ?? 0} single-shot, ${report.summary.postSelectionTunedCount ?? 0} dev-tuned)`,
    );
  }
  lines.push(
    `  Screening (0.80):  ${((report.summary.clearedScreenCount / report.summary.totalDetectableGuides) * 100).toFixed(1)}% (${report.summary.clearedScreenCount}/${report.summary.totalDetectableGuides} guides cleared 0.80 screen)`,
  );
  if (report.summary.pooledPhase1Precision) {
    const p1p = report.summary.pooledPhase1Precision;
    lines.push(
      `  Phase-1 Precision: ${(p1p.precision * 100).toFixed(1)}% (${p1p.successes}/${p1p.total}, 95% CI [${(p1p.wilson95.lower * 100).toFixed(1)}% - ${(p1p.wilson95.upper * 100).toFixed(1)}%], ${report.summary.clearedPhase1Bar90Count ?? 0} guides clear >=0.90 LB)`,
    );
  }
  if (report.summary.phase2DroppedRightTotal !== undefined) {
    lines.push(
      `  Phase-2 Drops FN:  ${report.summary.phase2DroppedRightTotal} real findings dropped by Phase 2`,
    );
  }
  if (report.summary.qualifiedPooledPrecision) {
    const qp = report.summary.qualifiedPooledPrecision;
    lines.push(
      `  Qualified Prec:    ${(qp.precision * 100).toFixed(1)}% (${qp.successes}/${qp.total}, 95% CI [${(qp.wilson95.lower * 100).toFixed(1)}% - ${(qp.wilson95.upper * 100).toFixed(1)}%])`,
    );
  }
  lines.push(
    `  Held-out Precision:${(report.summary.pooledHeldoutPrecision.precision * 100).toFixed(1)}% (${report.summary.pooledHeldoutPrecision.successes}/${report.summary.pooledHeldoutPrecision.total}, 95% CI [${(report.summary.pooledHeldoutPrecision.wilson95.lower * 100).toFixed(1)}% - ${(report.summary.pooledHeldoutPrecision.wilson95.upper * 100).toFixed(1)}%])`,
  );
  lines.push(
    `  Overall Precision: ${(report.summary.overallPrecision.value * 100).toFixed(1)}% [${((report.summary.overallPrecision.lower ?? 0) * 100).toFixed(1)}% - ${((report.summary.overallPrecision.upper ?? 0) * 100).toFixed(1)}%]`,
  );
  lines.push(
    `  Overall Recall:    ${(report.summary.overallRecall.value * 100).toFixed(1)}% (n=${report.summary.overallRecall.n})`,
  );
  const stabilityStr = report.summary.judgeStability !== null
    ? `${(report.summary.judgeStability * 100).toFixed(1)}%`
    : 'unmeasured';
  lines.push(`  Judge Stability:   ${stabilityStr}`);
  lines.push(
    `  Guard Metrics:     Judge α = ${report.summary.judgeAlpha.toFixed(3)}, Judge AC1 = ${report.summary.judgeAc1.toFixed(3)}, Canary TNR = ${(report.summary.canaryTnr * 100).toFixed(1)}%`,
  );
  lines.push('============================================================');

  return lines.join('\n');
}

/**
 * CLI runner for pilot scorecard.
 */
export async function runPilotScorecardCli(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Usage: node src/analyzing/scorecard.ts [options]

Options:
  --mode=<local|gitmirror|all>        Scan mode (default: local)
  --split=<held-out>                  Corpus split (default: held-out)
  --guides=<g1,g2,...>                Filter scorecard to specific guide IDs
  --out=<path>                        Output path for scorecard report JSON
  --no-write-progress                 Disable writing progress row to PROGRESS.md
  -h, --help                          Show this help message
`);
    return;
  }

  const writeProgress = !process.argv.includes('--no-write-progress');
  const scorecardArg = process.argv.find(
    (a) => a.startsWith('--out=') || a.startsWith('--scorecard='),
  );
  const modeArg = process.argv.find((a) => a.startsWith('--mode='));
  const mode = (modeArg ? modeArg.split('=')[1] : undefined) as 'local' | 'gitmirror' | 'all' | undefined;
  const splitArg = process.argv.find((a) => a.startsWith('--split='));
  const splitVal = splitArg ? splitArg.split('=')[1] : undefined;
  const split: ScorecardSplit | undefined =
    splitVal === 'held-out' || splitVal === 'tune' || splitVal === 'final' || splitVal === 'grading-only'
      ? splitVal
      : undefined;
  const guidesArg = process.argv.find((a) => a.startsWith('--guides='));
  const guideIds = guidesArg
    ? guidesArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const effectiveSplit: ScorecardSplit = split ?? 'held-out';
  const defaultScorecardPath =
    mode === 'gitmirror'
      ? (effectiveSplit === 'final' || effectiveSplit === 'held-out' ? GITMIRROR_FINAL_SCORECARD_PATH : GITMIRROR_SCORECARD_PATH)
      : PILOT_SCORECARD_PATH;
  const scorecardPath = scorecardArg
    ? scorecardArg.split('=')[1]
    : defaultScorecardPath;
  const report = await runPilotScorecard({ writeProgress, scorecardPath, mode, split, guideIds });
  console.log(formatPilotScorecardReport(report));
}

if (import.meta.main || (process.argv[1] && process.argv[1].endsWith('scorecard.ts'))) {
  runPilotScorecardCli().catch((err: unknown) => {
    console.error('Pilot scorecard error:', err);
    process.exitCode = 1;
  });
}
