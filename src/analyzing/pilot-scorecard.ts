import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  checkCanaries,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  loadGuideSummariesMap,
  loadPaulIrishScoredCards,
  prepareBlindCards,
  runJudgeDirect,
  type BlindCardPayload,
  type CalibrationDeckItem,
  type CanaryCard,
  type CanaryCheckResult,
  type GuideSummaryInfo,
  type JudgeEvaluationMetrics,
  type JudgeResult,
  type JudgeRunOptions,
  type StabilityEvaluationResult,
} from './judge.ts';
import {
  ANALYZER_INTERNAL_DIR,
  GRADES_PATH,
  M3_SPOTCHECK_DECK_PATH,
  PROGRESS_LOG_PATH,
  REPOS_CONFIG_PATH,
  WORKTREE_ROOT,
  repoDir,
  type RepoConfigEntry,
} from './paths.ts';
import { runPhase2Filter, type Phase2Options } from './phase2.ts';
import {
  computeFileHash,
  getGitCommitState,
  recordProgressLogEntry,
  type MetricEntry,
  type ProgressLogRow,
} from './progress-log.ts';
import { ALL_RULES, PILOT_RULES } from './rules/index.ts';
import { scanRepoFiles } from './scanners/index.ts';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';
import {
  checkSequentialStop,
  wilsonInterval,
  type BinomialInterval,
  type SequentialStopDecision,
  Z_95,
  Z_SEQUENTIAL_STOPPING,
} from './stats.ts';

export const Z_80 = 1.28155;
export const MAX_SAMPLE_PER_GUIDE = 40;

export const PILOT_SCORECARD_PATH = join(
  ANALYZER_INTERNAL_DIR,
  'findings',
  '2026-10-14-pilot-scorecard.json',
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
    repo: 'synthetic-canary',
    file: 'src/components/accordion.css',
    line: 12,
    guideId: 'animate-to-intrinsic-sizes',
    guideSummary: {
      guideId: 'animate-to-intrinsic-sizes',
      problem: 'CSS transition on max-height simulates intrinsic size animation',
      before: 'transition: max-height 0.5s ease',
      now: 'interpolate-size: allow-keywords; transition: height 0.5s ease;',
    },
    codeSnippet: `/* Negative Canary: Already Modern */
:root {
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
    repo: 'synthetic-canary',
    file: 'src/utils/logger.ts',
    line: 8,
    guideId: 'coordinate-global-events',
    guideSummary: {
      guideId: 'coordinate-global-events',
      problem: 'Legacy timezone math or moment-timezone instead of Temporal.ZonedDateTime',
      before: 'moment.tz(d, "America/New_York") or Date.prototype.getTimezoneOffset()',
      now: 'Temporal.ZonedDateTime',
    },
    codeSnippet: `// Negative Canary: Parameter shadows moment; not a timezone conversion
function logTimestampWithMoment(moment: { name: string; tz: string; timestamp: number }): string {
  const tz = moment.tz ?? 'UTC';
  return \`[\${moment.name}] \${moment.timestamp} (\${tz})\`;
}`,
  },
  {
    cardId: 'canary-neg-feature-guarded',
    repo: 'synthetic-canary',
    file: 'src/ui/modal-trigger.ts',
    line: 10,
    guideId: 'declarative-dialog-popover-control',
    guideSummary: {
      guideId: 'declarative-dialog-popover-control',
      problem: 'Imperative click listener toggles dialog instead of declarative commandfor',
      before: 'btn.addEventListener("click", () => dialog.showModal())',
      now: '<button commandfor="my-dialog" command="show-modal">',
    },
    codeSnippet: `// Negative Canary: Intentional legacy fallback protected by feature guard
if ('commandForElement' in HTMLButtonElement.prototype) {
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
    expectedVerdict: 'leave-it',
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

export interface GuideScorecard {
  readonly guideId: string;
  readonly ruleIds: readonly string[];
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
  readonly recall: GuideRecallMetrics;
}

export interface PilotScorecardSummary {
  readonly totalDetectableGuides: number;
  readonly clearedBarCount: number;
  readonly clearedBar90Count?: number;
  readonly clearedSampleConstrainedCount?: number;
  readonly clearedScreenCount: number;
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
  readonly judgeStability: number;
  readonly judgeAlpha: number;
  readonly judgeAc1: number;
  readonly canaryTnr: number;
  readonly canaryViolations: readonly unknown[];
}

export interface PilotScorecardReport {
  readonly timestamp: string;
  readonly commit: string;
  readonly ruleSetHash: string;
  readonly splitHash: string;
  readonly gradesHash: string;
  readonly judgeVersion: string;
  readonly guides: readonly GuideScorecard[];
  readonly summary: PilotScorecardSummary;
  readonly canaries: readonly CanaryCard[];
}

export interface PilotScorecardOptions {
  readonly reposConfigPath?: string;
  readonly gradesPath?: string;
  readonly rules?: readonly AnalyzerRule[];
  readonly rulesDir?: string;
  readonly scorecardPath?: string;
  readonly progressLogPath?: string;
  readonly spotcheckDeckPath?: string;
  readonly writeProgress?: boolean;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
  readonly concurrency?: number;
  readonly maxSequentialSample?: number;
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
    const list = byRepo.get(r)!;
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
      const list = byRepo.get(r)!;
      const idx = repoIndices.get(r)!;
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
 * Scans all eligible grading-only repos on disk using PILOT_RULES.
 */
export async function scanGradingRepos(
  gradingRepos: readonly RepoConfigEntry[],
  rules: readonly AnalyzerRule[] = PILOT_RULES,
): Promise<AnalyzerFinding[]> {
  const allFindings: AnalyzerFinding[] = [];

  for (const entry of gradingRepos) {
    const dir = repoDir(entry);
    const findings = await scanRepoFiles(dir, rules, {
      repo: entry.repo,
      commit: entry.commit,
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
    code: f.astSlice || f.codeSnippet,
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
 * Executes the complete held-out evaluation for Milestone 2 pilot rules.
 */
export async function runPilotScorecard(
  options: PilotScorecardOptions = {},
): Promise<PilotScorecardReport> {
  const reposPath = options.reposConfigPath ?? REPOS_CONFIG_PATH;
  const gradesPath = options.gradesPath ?? GRADES_PATH;
  const rules = options.rules ?? ALL_RULES;
  const targetGuideIds: readonly string[] = Array.from(new Set(rules.map((r) => r.guideId)));
  const rulesDir = options.rulesDir ?? join(WORKTREE_ROOT, 'src/analyzing/rules');
  const maxSample = options.maxSequentialSample ?? MAX_SAMPLE_PER_GUIDE;
  const concurrency = options.concurrency ?? 10;
  const customFetch = options.fetchFn;
  const apiKey = options.apiKey;

  // 1. Load repos.json and select grading-only split
  const reposRaw = await readFile(reposPath, 'utf8');
  const allRepos = JSON.parse(reposRaw) as RepoConfigEntry[];
  const gradingRepos = allRepos.filter((r) => r.split === 'grading-only');

  // 2. Scan grading-only repos with frozen pilot rules (Phase 1)
  const phase1Findings = await scanGradingRepos(gradingRepos, rules);

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

  // 3. Deterministically stratified-sample up to maxSample (60) per guide
  const sampledFindingsByGuide = new Map<string, AnalyzerFinding[]>();
  const allSampledFindings: AnalyzerFinding[] = [];

  for (const gid of targetGuideIds) {
    const guideFindings = findingsByGuide.get(gid) ?? [];
    const sampled = stratifiedSampleFindings(guideFindings, maxSample);
    sampledFindingsByGuide.set(gid, sampled);
    allSampledFindings.push(...sampled);
  }

  // 4. Run Phase 2 filter on all sampled findings
  const rulesById = new Map<string, AnalyzerRule>();
  for (const r of rules) {
    rulesById.set(r.id, r);
    rulesById.set(r.guideId, r);
  }

  const phase2Opts: Phase2Options = {
    apiKey,
    fetchFn: customFetch,
    concurrency,
  };

  const phase2Result = await runPhase2Filter(allSampledFindings, rulesById, phase2Opts);
  const phase2KeptByGuide = new Map<string, AnalyzerFinding[]>();
  for (const gid of targetGuideIds) {
    phase2KeptByGuide.set(gid, []);
  }
  for (const kept of phase2Result.keptFindings) {
    const list = phase2KeptByGuide.get(kept.guideId) ?? [];
    list.push(kept);
    phase2KeptByGuide.set(kept.guideId, list);
  }

  // 5. Load guide summaries and prepare blind cards
  const summaries = await loadGuideSummariesMap();
  const keptBlindCards: BlindCardPayload[] = phase2Result.keptFindings.map((finding) => {
    const summary = summaries.get(finding.guideId) ?? {
      guideId: finding.guideId,
      problem: 'Legacy web platform pattern',
      before: 'Uses legacy platform API or workaround',
      now: 'Modern web platform standard API',
    };
    const rule = rulesById.get(finding.ruleId) ?? rulesById.get(finding.guideId);
    const enrichedSummary: GuideSummaryInfo = {
      ...summary,
      ...(rule
        ? {
            ruleSummary: rule.summary,
            keepWhen: rule.phase2Rubric.keepWhen,
            dropWhen: rule.phase2Rubric.dropWhen,
          }
        : {}),
    };
    return {
      cardId: finding.cardId,
      repo: finding.repo,
      file: finding.file,
      line: finding.line,
      guideId: finding.guideId,
      guideSummary: enrichedSummary,
      codeSnippet: finding.astSlice || finding.codeSnippet,
    };
  });

  // Load Paul's 85 scored cards to calibrate judge stability and guard metrics (α, AC1)
  const { cards: scoredCards, humanVerdicts } = await loadPaulIrishScoredCards(gradesPath);
  const scoredBlindCards = await prepareBlindCards(scoredCards, summaries, reposPath);

  // Combine cards: scored human cards + Phase 2 kept findings + 3 synthetic canaries
  const combinedCardsMap = new Map<string, BlindCardPayload>();
  for (const c of scoredBlindCards) {
    combinedCardsMap.set(c.cardId, c);
  }
  for (const c of keptBlindCards) {
    combinedCardsMap.set(c.cardId, c);
  }
  for (const c of SYNTHETIC_CANARY_CARDS) {
    combinedCardsMap.set(c.cardId, c);
  }

  const allEvaluationCards = Array.from(combinedCardsMap.values());

  // 6. Execute 3 stability runs with majority-vote judge
  const judgeOpts: JudgeRunOptions = {
    apiKey,
    fetchFn: customFetch,
    mode: 'direct',
    concurrency,
  };

  const run0 = await runJudgeDirect(allEvaluationCards, judgeOpts);
  const run1 = await runJudgeDirect(allEvaluationCards, judgeOpts);
  const run2 = await runJudgeDirect(allEvaluationCards, judgeOpts);

  const stability: StabilityEvaluationResult = evaluateJudgeStability([run0, run1, run2]);
  const consensusVerdicts = new Map<string, JudgeResult>();
  for (const r of stability.consensusResults) {
    consensusVerdicts.set(r.cardId, r);
  }

  // 7. Verify canaries (Paul's 2 FPs + 3 synthetic canaries)
  const canaryResult: CanaryCheckResult = checkCanaries(stability.consensusResults, CANARY_CONFIG);
  if (canaryResult.tnr < 1.0) {
    throw new Error(
      `Canary TNR failed: ${canaryResult.tnr * 100}% (expected 100%). Violations: ${JSON.stringify(canaryResult.violations)}`,
    );
  }

  // 8. Compute inter-rater agreement & guard metrics against Paul's 85 human grades
  const droppedCardIds = new Set(['2547b2ba6d74', '7f2a96f62a4c']);
  const evalMetrics: JudgeEvaluationMetrics = evaluateJudgeMetrics(
    stability.consensusResults,
    humanVerdicts,
    droppedCardIds,
  );

  // 9. Compute recall on Paul's labeled positives
  const scoredCardsByGuide = new Map<string, string[]>();
  for (const gid of targetGuideIds) {
    scoredCardsByGuide.set(gid, []);
  }
  for (const [cardId, verdict] of humanVerdicts.entries()) {
    if (verdict === 'right') {
      const card = scoredCards.find((c) => c.cardId === cardId);
      if (card && scoredCardsByGuide.has(card.guideId)) {
        scoredCardsByGuide.get(card.guideId)!.push(cardId);
      }
    }
  }

  const phase1CardIds = new Set(phase1Findings.map((f) => f.cardId));
  const phase2KeptCardIds = new Set(phase2Result.keptFindings.map((f) => f.cardId));

  // 10. Compute per-guide scorecard
  let totalPhase2Kept = 0;
  let totalJudgedRight = 0;
  let totalLabeledPositives = 0;
  let totalPhase2Recalled = 0;
  let clearedBarCount = 0;
  let clearedBar90Count = 0;
  let clearedSampleConstrainedCount = 0;
  let clearedScreenCount = 0;

  const guideScorecards: GuideScorecard[] = [];

  for (const gid of targetGuideIds) {
    const guideRules = rules.filter((r) => r.guideId === gid);
    const ruleIds = guideRules.map((r) => r.id);

    const p1Total = (findingsByGuide.get(gid) ?? []).length;
    const p1Sampled = (sampledFindingsByGuide.get(gid) ?? []).length;
    const p2Kept = phase2KeptByGuide.get(gid) ?? [];
    const p2KeptCount = p2Kept.length;
    const p2DroppedCount = p1Sampled - p2KeptCount;

    let rightCount = 0;
    for (const f of p2Kept) {
      const res = consensusVerdicts.get(f.cardId);
      if (res && res.verdict === 'right') {
        rightCount++;
      }
    }

    const fpCount = p2KeptCount - rightCount;
    const precision = p2KeptCount > 0 ? rightCount / p2KeptCount : 0;
    const wilson80 = wilsonInterval(rightCount, p2KeptCount, Z_80);
    const wilson95 = wilsonInterval(rightCount, p2KeptCount, Z_95);
    const seqDecision = checkSequentialStop(rightCount, p2KeptCount, 0.9);
    const clearsBar90 = wilson95.lower >= 0.9 || seqDecision === 'pass';
    const clearsScreen80 = wilson95.lower >= 0.8;
    const isSampleConstrained = p2KeptCount < 35;
    const clearsSampleConstrained =
      isSampleConstrained && wilson95.lower >= 0.8 && precision >= 0.95;
    const clearsPrecisionBar = clearsBar90 || clearsSampleConstrained;

    if (clearsPrecisionBar) {
      clearedBarCount++;
    }
    if (clearsBar90) {
      clearedBar90Count++;
    }
    if (clearsSampleConstrained) {
      clearedSampleConstrainedCount++;
    }
    if (clearsScreen80) {
      clearedScreenCount++;
    }

    // Recall metrics
    const positiveIds = scoredCardsByGuide.get(gid) ?? [];
    const nPos = positiveIds.length;
    const p1Recalled = positiveIds.filter((id) => phase1CardIds.has(id)).length;
    const p2Recalled = positiveIds.filter((id) => phase2KeptCardIds.has(id)).length;

    totalPhase2Kept += p2KeptCount;
    totalJudgedRight += rightCount;
    totalLabeledPositives += nPos;
    totalPhase2Recalled += p2Recalled;

    guideScorecards.push({
      guideId: gid,
      ruleIds,
      phase1TotalYield: p1Total,
      phase1SampledCount: p1Sampled,
      phase2KeptCount: p2KeptCount,
      phase2DroppedCount: p2DroppedCount,
      judgeJudgedCount: p2KeptCount,
      judgeRightCount: rightCount,
      judgeFalsePositiveCount: fpCount,
      precision: Number(precision.toFixed(4)),
      wilson80,
      wilson95,
      sequentialStopDecision: seqDecision,
      clearsPrecisionBar,
      clearsBar90,
      clearsScreen80,
      clearsSampleConstrained,
      isSampleConstrained,
      recall: {
        labeledPositivesTotal: nPos,
        phase1Recalled: p1Recalled,
        phase2Recalled: p2Recalled,
        phase1RecallRate: nPos > 0 ? Number((p1Recalled / nPos).toFixed(4)) : 0,
        phase2RecallRate: nPos > 0 ? Number((p2Recalled / nPos).toFixed(4)) : 0,
      },
    });
  }

  // 11. Compute aggregate metrics
  const gitState = getGitCommitState();
  const ruleSetHash = await computeRuleSetHash(rulesDir);
  const splitHash = await computeFileHash(reposPath);
  const gradesHash = await computeFileHash(gradesPath);
  const judgeVersion = `gemini-3.8-flash:detective-v3-direct`;

  const coverageMetric: MetricEntry = {
    value: Number((clearedBarCount / targetGuideIds.length).toFixed(4)),
    n: targetGuideIds.length,
    split: 'grading-only',
  };

  const pooledHeldoutWilson = wilsonInterval(totalJudgedRight, totalPhase2Kept, Z_95);
  const heldOutPrecisionMetric: MetricEntry = {
    value: totalPhase2Kept > 0 ? Number((totalJudgedRight / totalPhase2Kept).toFixed(4)) : 0,
    lower: Number(pooledHeldoutWilson.lower.toFixed(4)),
    upper: Number(pooledHeldoutWilson.upper.toFixed(4)),
    n: totalPhase2Kept,
    split: 'grading-only, judged',
  };

  const ppi = evalMetrics.ppiPrecision;
  const ppiPrecisionMetric: MetricEntry = {
    value: Number(ppi.estimate.toFixed(4)),
    lower: Number(ppi.lower.toFixed(4)),
    upper: Number(ppi.upper.toFixed(4)),
    n: scoredCards.length,
    split: 'grading-only',
  };

  const recallWilson = wilsonInterval(totalPhase2Recalled, totalLabeledPositives, Z_95);
  const recallMetric: MetricEntry = {
    value:
      totalLabeledPositives > 0
        ? Number((totalPhase2Recalled / totalLabeledPositives).toFixed(4))
        : 0,
    lower: Number(recallWilson.lower.toFixed(4)),
    upper: Number(recallWilson.upper.toFixed(4)),
    n: totalLabeledPositives,
    split: 'grading-only',
  };

  const summary: PilotScorecardSummary = {
    totalDetectableGuides: targetGuideIds.length,
    clearedBarCount,
    clearedBar90Count,
    clearedSampleConstrainedCount,
    clearedScreenCount,
    coverage: coverageMetric,
    overallPrecision: heldOutPrecisionMetric,
    overallRecall: recallMetric,
    pooledHeldoutPrecision: {
      successes: totalJudgedRight,
      total: totalPhase2Kept,
      precision: totalPhase2Kept > 0 ? Number((totalJudgedRight / totalPhase2Kept).toFixed(4)) : 0,
      wilson95: pooledHeldoutWilson,
    },
    ppiPrecision: ppiPrecisionMetric,
    judgeStability: Number(stability.stabilityRate.toFixed(4)),
    judgeAlpha: Number(evalMetrics.krippendorffAlpha.toFixed(3)),
    judgeAc1: Number(evalMetrics.gwetAc1.toFixed(3)),
    canaryTnr: Number(canaryResult.tnr.toFixed(4)),
    canaryViolations: canaryResult.violations,
  };

  const report: PilotScorecardReport = {
    timestamp: new Date().toISOString(),
    commit: gitState.commit,
    ruleSetHash,
    splitHash,
    gradesHash,
    judgeVersion,
    guides: guideScorecards,
    summary,
    canaries: CANARY_CONFIG,
  };

  // 12. Save scorecard JSON to analyzer-internal/findings/
  const outPath = options.scorecardPath ?? PILOT_SCORECARD_PATH;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

  // Save spot-check deck per G6 to analyzer-internal/labels/m3-spotcheck-deck.json
  const spotcheckPath = options.spotcheckDeckPath ?? M3_SPOTCHECK_DECK_PATH;
  const spotcheckCards = sampleM3SpotcheckDeck(phase2Result.keptFindings, 10);
  await mkdir(dirname(spotcheckPath), { recursive: true });
  await writeFile(spotcheckPath, JSON.stringify(spotcheckCards, null, 2), 'utf8');

  // 13. Optionally write to PROGRESS.md
  if (options.writeProgress) {
    const progressLogPath = options.progressLogPath ?? PROGRESS_LOG_PATH;
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
      notes: `Milestone 3 evaluation (${clearedBarCount}/${targetGuideIds.length} guides cleared bar [${clearedBar90Count} at >=0.90 CI lower, ${clearedSampleConstrainedCount} sample-constrained >=0.80 CI lower & >=0.95 prec], pooled held-out prec=${(summary.pooledHeldoutPrecision.precision * 100).toFixed(1)}%, stability=${(summary.judgeStability * 100).toFixed(1)}%, canaryTNR=100.0%)`,
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
    `Split Hash:    ${report.splitHash}`,
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

    lines.push(
      `  * ${g.guideId.padEnd(36)}: P1=${String(g.phase1TotalYield).padStart(3)} | P2_kept=${String(g.phase2KeptCount).padStart(2)} | Right=${String(g.judgeRightCount).padStart(2)} | Prec=${prec.padStart(6)} (95% CI ${w95}, 80% CI ${w80}) | SeqStop=${g.sequentialStopDecision} | Bar90=${bar90} | Screen80=${screen80} | Recall=${rec}`,
    );
  }

  lines.push('------------------------------------------------------------');
  lines.push('SUMMARY:');
  const bar90Count = report.summary.clearedBar90Count ?? report.summary.clearedBarCount;
  const sampleCount = report.summary.clearedSampleConstrainedCount ?? 0;
  lines.push(
    `  Coverage:          ${(report.summary.coverage.value * 100).toFixed(1)}% (${report.summary.clearedBarCount}/${report.summary.totalDetectableGuides} guides cleared bar: ${bar90Count} at >=0.90 CI lower, ${sampleCount} sample-constrained >=0.80 CI & >=0.95 prec)`,
  );
  lines.push(
    `  Screening (0.80):  ${((report.summary.clearedScreenCount / report.summary.totalDetectableGuides) * 100).toFixed(1)}% (${report.summary.clearedScreenCount}/${report.summary.totalDetectableGuides} guides cleared 0.80 screen)`,
  );
  lines.push(
    `  Held-out Precision:${(report.summary.pooledHeldoutPrecision.precision * 100).toFixed(1)}% (${report.summary.pooledHeldoutPrecision.successes}/${report.summary.pooledHeldoutPrecision.total}, 95% CI [${(report.summary.pooledHeldoutPrecision.wilson95.lower * 100).toFixed(1)}% - ${(report.summary.pooledHeldoutPrecision.wilson95.upper * 100).toFixed(1)}%])`,
  );
  lines.push(
    `  Overall Precision: ${(report.summary.overallPrecision.value * 100).toFixed(1)}% [${(report.summary.overallPrecision.lower! * 100).toFixed(1)}% - ${(report.summary.overallPrecision.upper! * 100).toFixed(1)}%]`,
  );
  lines.push(
    `  Overall Recall:    ${(report.summary.overallRecall.value * 100).toFixed(1)}% (n=${report.summary.overallRecall.n})`,
  );
  lines.push(
    `  Judge Stability:   ${(report.summary.judgeStability * 100).toFixed(1)}%`,
  );
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
  const writeProgress = !process.argv.includes('--no-write-progress');
  const report = await runPilotScorecard({ writeProgress });
  console.log(formatPilotScorecardReport(report));
}

if (import.meta.main || (process.argv[1] && process.argv[1].endsWith('pilot-scorecard.ts'))) {
  runPilotScorecardCli().catch((err: unknown) => {
    console.error('Pilot scorecard error:', err);
    process.exitCode = 1;
  });
}
