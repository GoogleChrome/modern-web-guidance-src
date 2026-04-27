export interface ScenarioCheck {
  id: string;
  passed: boolean;
  message: string;
  isEarlyFailure?: boolean;
}

export interface RunResult {
  runNumber: number;
  results: ScenarioCheck[];
  guidesUsed?: string[];
  guidanceToolsUsed?: string[];
  expectedToolPrefixes?: string[];
  guideName?: string;
  isSkill?: boolean;
  taskName?: string;
  baseApp?: string;
  prompt?: string;
  tokenUsage?: { total: number; cached: number };
}

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
    totalGuidedNonDisciplineRuns?: number;
    toolActivationRate?: number;
    toolActivationCount?: number;
    unguidedEarlyFailures?: number;
    unguidedEarlyFailureRate?: number;
    guidedEarlyFailures?: number;
    guidedEarlyFailureRate?: number;
    guidedNonDisciplineEarlyFailures?: number;
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
    isSkill?: boolean;
    earlyFailures?: number;
    avgTokens?: { total: number; cached: number };
  }>;
  sortedKeys: string[];
}

export interface EvalsReport {
  summary: Metrics['summary'];
  results: Record<string, RunResult[]>;
  stats: Metrics['testStats'];
  timestamp: string;
  runCount: number;
  agent: string;
  serving: string;
  model: string;
  totalRuntime?: number;
}

export function calculateMetrics(allResults: Record<string, RunResult[]>, runsPerTest: number): Metrics {
  // Dynamic sorting: Tasks alphabetically, then Guides alphabetically, then Run Type (unguided first if present)
  const runTypeOrder: Record<string, number> = { 'unguided': 1, 'guided': 2 };

  const sortedKeys = Object.keys(allResults).sort((a, b) => {
    const [taskNameA, guideNameA, runTypeA] = a.split(' - ');
    const [taskNameB, guideNameB, runTypeB] = b.split(' - ');

    if (taskNameA !== taskNameB) {
      return taskNameA.localeCompare(taskNameB);
    }
    if (guideNameA !== guideNameB) {
      return guideNameA.localeCompare(guideNameB);
    }

    // Sort known run types first, others alphabetically
    const orderA = runTypeOrder[runTypeA] || 99;
    const orderB = runTypeOrder[runTypeB] || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return runTypeA.localeCompare(runTypeB);
  });

  const testStats: Record<string, {
    medianPassRate: number;
    runPassRates: number[];
    runsUsingGuide?: number;
    runsWithToolActivation?: number;
    runCount?: number;
    passedChecks: number;
    totalChecks: number;
    isSkill?: boolean;
    earlyFailures?: number;
    avgTokens?: { total: number; cached: number };
  }> = {};

  for (const name of sortedKeys) {
    const runs = allResults[name];
    let passedChecks = 0;
    let totalChecks = 0;

    let earlyFailures = 0;
    const passRates = runs.map(run => {
      const checks = run.results;
      const isEarlyFailure = checks.some(c => c.isEarlyFailure);
      if (isEarlyFailure) {
        earlyFailures++;
      }
      const passCount = checks.filter(c => c.passed).length;
      const totalCount = checks.length;
      passedChecks += passCount;
      totalChecks += totalCount;
      return totalCount > 0 ? (passCount / totalCount) * 100 : 0;
    }).sort((a, b) => a - b);

    const mid = Math.floor(passRates.length / 2);
    const median = passRates.length % 2 === 0
      ? (passRates[mid - 1] + passRates[mid]) / 2
      : passRates[mid];

    let guideUsageCount = 0;
    let toolActivationCount = 0;
    const [, , runType] = name.split(' - ');

    if (runType === 'guided') {
      runs.forEach(run => {
        const guidesUsed = run.guidesUsed || [];
        const expectedGuide = run.guideName;
        // For skills, we track guides used but there is no expected guide
        if (!run.isSkill && expectedGuide && guidesUsed.includes(expectedGuide)) {
          guideUsageCount++;
        }

        const toolsUsed = run.guidanceToolsUsed || [];
        const prefixes = run.expectedToolPrefixes || [];
        if (prefixes.length > 0 && toolsUsed.some(t => prefixes.some(p => t.startsWith(p)))) {
          toolActivationCount++;
        }
      });
    }

    let totalTokensForConfig = 0;
    let cachedTokensForConfig = 0;
    let runsWithTokenData = 0;

    runs.forEach(run => {
      if (run.tokenUsage) {
        totalTokensForConfig += run.tokenUsage.total || 0;
        cachedTokensForConfig += run.tokenUsage.cached || 0;
        runsWithTokenData++;
      }
    });

    testStats[name] = {
      medianPassRate: Math.round(median),
      runPassRates: passRates.map(r => Math.round(r)),
      runsUsingGuide: runType === 'guided' ? guideUsageCount : undefined,
      runsWithToolActivation: runType === 'guided' ? toolActivationCount : undefined,
      runCount: runs.length,
      isSkill: runs[0]?.isSkill,
      passedChecks,
      totalChecks,
      earlyFailures,
      avgTokens: runsWithTokenData > 0 ? {
        total: Math.round(totalTokensForConfig / runsWithTokenData),
        cached: Math.round(cachedTokensForConfig / runsWithTokenData)
      } : undefined
    };
  }

  const calcSummary = (keys: string[]) => {
    const medians = keys.map(k => testStats[k].medianPassRate);

    const sortedMedians = [...medians].sort((a, b) => a - b);
    const mid = Math.floor(sortedMedians.length / 2);
    const median = sortedMedians.length === 0 ? 0 :
      (sortedMedians.length % 2 === 0
        ? (sortedMedians[mid - 1] + sortedMedians[mid]) / 2
        : sortedMedians[mid]);

    let passed = 0;
    let total = 0;
    let guideUsageCount = 0;
    let toolActivationCount = 0;
    let totalGuidedRuns = 0;
    let totalGuidedNonDisciplineRuns = 0;
    let guidedNonDisciplineEarlyFailures = 0;
    let guidedEarlyFailures = 0;
    let earlyFailures = 0;
    let totalRuns = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let configsWithTokenData = 0;

    keys.forEach(k => {
      const [, , runType] = k.split(' - ');
      const stats = testStats[k];

      if (stats) {
        passed += stats.passedChecks;
        total += stats.totalChecks;
        earlyFailures += stats.earlyFailures || 0;
        totalRuns += stats.runCount || 0;

        if (stats.avgTokens) {
          totalTokens += stats.avgTokens.total * (stats.runCount || 1);
          cachedTokens += stats.avgTokens.cached * (stats.runCount || 1);
          configsWithTokenData++;
        }

        if (runType === 'guided') {
          guideUsageCount += stats.runsUsingGuide || 0;
          toolActivationCount += stats.runsWithToolActivation || 0;
          totalGuidedRuns += stats.runCount || 0;

          if (!stats.isSkill) {
            totalGuidedNonDisciplineRuns += stats.runCount || 0;
            guidedNonDisciplineEarlyFailures += stats.earlyFailures || 0;
          }
          guidedEarlyFailures += stats.earlyFailures || 0;
        }
      }
    });

    const completedGuidedRuns = totalGuidedRuns - guidedEarlyFailures;
    const completedGuidedNonDisciplineRuns = totalGuidedNonDisciplineRuns - guidedNonDisciplineEarlyFailures;

    return {
      median: Math.round(median),
      passed,
      total,
      rate: total ? Math.round((passed / total) * 100) : 0,
      guideUsageCount,
      totalGuidedRuns,
      totalGuidedNonDisciplineRuns,
      toolActivationCount,
      earlyFailures,
      totalRuns,
      earlyFailureRate: totalRuns ? Math.round((earlyFailures / totalRuns) * 100) : 0,
      toolActivationRate: completedGuidedRuns ? Math.round((toolActivationCount / completedGuidedRuns) * 100) : 0,
      guideUsageRate: completedGuidedNonDisciplineRuns ? Math.round((guideUsageCount / completedGuidedNonDisciplineRuns) * 100) : 0,
      guidedNonDisciplineEarlyFailures,
      totalTokens: configsWithTokenData > 0 ? { total: totalTokens, cached: cachedTokens } : undefined
    };
  };

  const uStats = calcSummary(sortedKeys.filter(k => k.includes(' - unguided')));
  const gStats = calcSummary(sortedKeys.filter(k => k.includes(' - guided')));

  const uniqueTasks = new Set<string>();
  Object.keys(allResults).forEach(key => {
    const [taskName, guideName] = key.split(' - ');
    uniqueTasks.add(`${taskName} - ${guideName}`);
  });
  const numberOfTasks = uniqueTasks.size;
  const expectedTotalRuns = numberOfTasks * runsPerTest;

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
      runsPerTest,
      expectedTotalRuns,
      taskCount: numberOfTasks,
      runCountPerTask: runsPerTest,
      guideUsageRate: gStats.guideUsageRate,
      guideUsageCount: gStats.guideUsageCount,
      totalGuidedRuns: gStats.totalGuidedRuns,
      totalGuidedNonDisciplineRuns: gStats.totalGuidedNonDisciplineRuns,
      toolActivationRate: gStats.toolActivationRate,
      toolActivationCount: gStats.toolActivationCount,
      unguidedEarlyFailures: uStats.earlyFailures,
      unguidedEarlyFailureRate: uStats.earlyFailureRate,
      guidedEarlyFailures: gStats.earlyFailures,
      guidedEarlyFailureRate: gStats.earlyFailureRate,
      guidedNonDisciplineEarlyFailures: gStats.guidedNonDisciplineEarlyFailures,
      totalTokens: totalTokensSum > 0 ? { total: totalTokensSum, cached: cachedTokensSum } : undefined,
      unguidedTotalTokens: uStats.totalTokens,
      guidedTotalTokens: gStats.totalTokens
    },
    testStats,
    sortedKeys
  };
}
