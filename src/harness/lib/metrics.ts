import type { ReasoningEffort } from './reasoning-effort.ts';

export interface PageLoadResult {
  ok: boolean;
  errors: string[];
  buildWarning?: string;
  noPage?: boolean;
}

export interface TrialCheck {
  id?: string;
  testId?: string;
  passed: boolean;
  message: string;
  isEarlyFailure?: boolean;
  failureReason?: string;
  error?: string;
  errorLocation?: string;
  pageSnapshot?: string;
  browserErrors?: string;
}

/** @deprecated Use `TrialCheck`. */
export type ScenarioCheck = TrialCheck;

export interface TrialResult {
  runNumber: number;
  results: TrialCheck[];
  guidesUsed?: string[];
  retrievedGuides?: string[];
  fileReadGuides?: string[];
  guidanceToolsUsed?: string[];
  expectedToolPrefixes?: string[];
  guideName?: string;
  taskName?: string;
  /** Guide category (e.g. `security`); per-guide views group charts by it. */
  discipline?: string;
  baseApp?: string;
  prompt?: string;
  targetFile?: string;
  runtime?: { agentRuntime?: number; graderRuntime?: number } | null;
  tokenUsage?: { total: number; cached: number };
  pageLoad?: PageLoadResult;
}

/** @deprecated Use `TrialResult`. */
export type RunResult = TrialResult;

export interface Metrics {
  summary: {
    unguidedMedian: number;
    guidedMedian: number;
    unguidedPassRate: number;
    guidedPassRate: number;
    unguidedPassed: number;
    unguidedTotal: number;
    guidedPassed: number;
    guidedTotal: number;
    runsPerTest: number;
    expectedTotalRuns?: number;
    taskCount?: number;
    runCountPerTask?: number;
    guideUsageRate?: number;
    guideUsageCount?: number;
    totalGuidedRuns?: number;
    toolActivationRate?: number;
    toolActivationCount?: number;

    unguidedEarlyFailures?: number;
    unguidedEarlyFailureRate?: number;
    guidedEarlyFailures?: number;
    guidedEarlyFailureRate?: number;
    totalTokens?: { total: number; cached: number };
    unguidedTotalTokens?: { total: number; cached: number };
    guidedTotalTokens?: { total: number; cached: number };
  };
  testStats: Record<string, {
    medianPassRate: number;
    runPassRates: number[];
    runsUsingGuide?: number;
    runsWithToolActivation?: number;
    runCount?: number;
    passedChecks: number;
    totalChecks: number;

    earlyFailures?: number;
    avgTokens?: { total: number; cached: number };
  }>;
  sortedKeys: string[];
}

export interface EvalsReport {
  summary: Metrics['summary'];
  results: Record<string, TrialResult[]>;
  stats: Metrics['testStats'];
  timestamp: string;
  runCount: number;
  agent: string;
  serving: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  totalRuntime?: number;
  skillVersion?: string;
  cliVersion?: string;
}

export function isInfraErrorTrial(checks?: TrialCheck[] | null): boolean {
  return !!(checks && checks.some(c => c.isEarlyFailure));
}

/** @deprecated Use `isInfraErrorTrial`. */
export const isEarlyFailureRun = isInfraErrorTrial;

export function calculateMetrics(allResults: Record<string, TrialResult[]>, trialsPerCondition: number): Metrics {
  const conditionOrder: Record<string, number> = { 'unguided': 1, 'guided': 2 };

  const sortedKeys = Object.keys(allResults).sort((a, b) => {
    const [taskNameA, guideNameA, conditionA] = a.split(' - ');
    const [taskNameB, guideNameB, conditionB] = b.split(' - ');

    if (taskNameA !== taskNameB) {
      return taskNameA.localeCompare(taskNameB);
    }
    if (guideNameA !== guideNameB) {
      return guideNameA.localeCompare(guideNameB);
    }

    const orderA = conditionOrder[conditionA] || 99;
    const orderB = conditionOrder[conditionB] || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return conditionA.localeCompare(conditionB);
  });

  const testStats: Metrics['testStats'] = {};

  for (const name of sortedKeys) {
    const trials = allResults[name];
    let passedChecks = 0;
    let totalChecks = 0;

    let infraErrors = 0;
    const passRates: number[] = [];
    for (const trial of trials) {
      const checks = trial.results;
      if (isInfraErrorTrial(checks)) {
        infraErrors++;
        continue;
      }
      const passCount = checks.filter(c => c.passed).length;
      const totalCount = checks.length;
      passedChecks += passCount;
      totalChecks += totalCount;
      if (totalCount > 0) {
        passRates.push((passCount / totalCount) * 100);
      }
    }
    passRates.sort((a, b) => a - b);

    const mid = Math.floor(passRates.length / 2);
    const median = passRates.length === 0 ? 0 : (
      passRates.length % 2 === 0
        ? (passRates[mid - 1] + passRates[mid]) / 2
        : passRates[mid]
    );

    let guideUsageCount = 0;
    let toolActivationCount = 0;
    const [, , condition] = name.split(' - ');

    if (condition === 'guided') {
      trials.forEach(trial => {
        if (isInfraErrorTrial(trial.results)) {
          return;
        }
        const guidesUsed = trial.guidesUsed || [];
        const expectedGuide = trial.guideName;
        if (expectedGuide && guidesUsed.includes(expectedGuide)) {
          guideUsageCount++;
        }

        const toolsUsed = trial.guidanceToolsUsed || [];
        const prefixes = trial.expectedToolPrefixes || [];
        if (prefixes.length > 0 && toolsUsed.some(t => prefixes.some(p => t.startsWith(p)))) {
          toolActivationCount++;
        }
      });
    }

    let totalTokensForConfig = 0;
    let cachedTokensForConfig = 0;
    let trialsWithTokenData = 0;

    trials.forEach(trial => {
      if (trial.tokenUsage) {
        totalTokensForConfig += trial.tokenUsage.total || 0;
        cachedTokensForConfig += trial.tokenUsage.cached || 0;
        trialsWithTokenData++;
      }
    });
    testStats[name] = {
      medianPassRate: Math.round(median),
      runPassRates: passRates.map(r => Math.round(r)),
      runsUsingGuide: condition === 'guided' ? guideUsageCount : undefined,
      runsWithToolActivation: condition === 'guided' ? toolActivationCount : undefined,
      runCount: trials.length,
      passedChecks,
      totalChecks,
      earlyFailures: infraErrors,
      avgTokens: trialsWithTokenData > 0 ? {
        total: Math.round(totalTokensForConfig / trialsWithTokenData),
        cached: Math.round(cachedTokensForConfig / trialsWithTokenData)
      } : undefined
    };
  }

  const uniqueTasks = new Set<string>();
  for (const name of sortedKeys) {
    uniqueTasks.add(name.replace(/ - (guided|unguided)$/, ''));
  }

  const calcSummary = (condition: 'guided' | 'unguided') => {
    const medians: number[] = [];
    let passed = 0;
    let total = 0;
    let guideUsageCount = 0;
    let toolActivationCount = 0;
    let totalGuidedTrials = 0;
    let guidedInfraErrors = 0;
    let infraErrors = 0;
    let totalTrials = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let configsWithTokenData = 0;

    for (const prefix of uniqueTasks) {
      const k = `${prefix} - ${condition}`;
      const otherKey = `${prefix} - ${condition === 'guided' ? 'unguided' : 'guided'}`;
      const stats = testStats[k];
      if (!stats) continue;

      const otherStats = testStats[otherKey];
      const validPair = stats.totalChecks > 0 && (!otherStats || otherStats.totalChecks > 0);

      if (validPair) {
        passed += stats.passedChecks;
        total += stats.totalChecks;
        medians.push(stats.medianPassRate);
      }
      infraErrors += stats.earlyFailures || 0;
      totalTrials += stats.runCount || 0;

      if (stats.avgTokens) {
        totalTokens += stats.avgTokens.total * (stats.runCount || 1);
        cachedTokens += stats.avgTokens.cached * (stats.runCount || 1);
        configsWithTokenData++;
      }

      if (condition === 'guided') {
        guideUsageCount += stats.runsUsingGuide || 0;
        toolActivationCount += stats.runsWithToolActivation || 0;
        totalGuidedTrials += stats.runCount || 0;
        guidedInfraErrors += stats.earlyFailures || 0;
      }
    }

    const sortedMedians = [...medians].sort((a, b) => a - b);
    const mid = Math.floor(sortedMedians.length / 2);
    const median = sortedMedians.length === 0 ? 0 :
      (sortedMedians.length % 2 === 0
        ? (sortedMedians[mid - 1] + sortedMedians[mid]) / 2
        : sortedMedians[mid]);

    const completedGuidedTrials = totalGuidedTrials - guidedInfraErrors;

    return {
      median: Math.round(median),
      passed,
      total,
      rate: total ? Math.round((passed / total) * 100) : 0,
      guideUsageCount,
      totalGuidedTrials,
      toolActivationCount,
      infraErrors,
      totalTrials,
      infraErrorRate: totalTrials ? Math.round((infraErrors / totalTrials) * 100) : 0,
      toolActivationRate: completedGuidedTrials ? Math.round((toolActivationCount / completedGuidedTrials) * 100) : 0,
      guideUsageRate: completedGuidedTrials ? Math.round((guideUsageCount / completedGuidedTrials) * 100) : 0,
      totalTokens: configsWithTokenData > 0 ? { total: totalTokens, cached: cachedTokens } : undefined
    };
  };

  const uStats = calcSummary('unguided');
  const gStats = calcSummary('guided');

  const numberOfTasks = uniqueTasks.size;
  const expectedTotalTrials = numberOfTasks * trialsPerCondition;

  const totalTokensSum = (uStats.totalTokens?.total || 0) + (gStats.totalTokens?.total || 0);
  const cachedTokensSum = (uStats.totalTokens?.cached || 0) + (gStats.totalTokens?.cached || 0);

  return {
    summary: {
      unguidedMedian: uStats.median,
      guidedMedian: gStats.median,
      unguidedPassRate: uStats.rate,
      guidedPassRate: gStats.rate,
      unguidedPassed: uStats.passed,
      unguidedTotal: uStats.total,
      guidedPassed: gStats.passed,
      guidedTotal: gStats.total,
      runsPerTest: trialsPerCondition,
      expectedTotalRuns: expectedTotalTrials,
      taskCount: numberOfTasks,
      runCountPerTask: trialsPerCondition,
      guideUsageRate: gStats.guideUsageRate,
      guideUsageCount: gStats.guideUsageCount,
      totalGuidedRuns: gStats.totalGuidedTrials,
      toolActivationRate: gStats.toolActivationRate,
      toolActivationCount: gStats.toolActivationCount,

      unguidedEarlyFailures: uStats.infraErrors,
      unguidedEarlyFailureRate: uStats.infraErrorRate,
      guidedEarlyFailures: gStats.infraErrors,
      guidedEarlyFailureRate: gStats.infraErrorRate,
      totalTokens: totalTokensSum > 0 ? { total: totalTokensSum, cached: cachedTokensSum } : undefined,
      unguidedTotalTokens: uStats.totalTokens,
      guidedTotalTokens: gStats.totalTokens
    },
    testStats,
    sortedKeys
  };
}
