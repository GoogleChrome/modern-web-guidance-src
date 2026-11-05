export interface ScenarioCheck {
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

export interface RunResult {
  runNumber: number;
  results: ScenarioCheck[];
  guidesUsed?: string[];
  guidanceToolsUsed?: string[];
  expectedToolPrefixes?: string[];
  guideName?: string;
  taskName?: string;
  baseApp?: string;
  prompt?: string;
  targetFile?: string;
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
  results: Record<string, RunResult[]>;
  stats: Metrics['testStats'];
  timestamp: string;
  runCount: number;
  agent: string;
  serving: string;
  model: string;
  totalRuntime?: number;
  skillVersion?: string;
  cliVersion?: string;
}

export function isEarlyFailureRun(checks?: ScenarioCheck[] | null): boolean {
  return !!(checks && checks.some(c => c.isEarlyFailure));
}

export function calculateMetrics(allResults: Record<string, RunResult[]>, runsPerTest: number): Metrics {
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

    const orderA = runTypeOrder[runTypeA] || 99;
    const orderB = runTypeOrder[runTypeB] || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return runTypeA.localeCompare(runTypeB);
  });

  const testStats: Metrics['testStats'] = {};

  for (const name of sortedKeys) {
    const runs = allResults[name];
    let passedChecks = 0;
    let totalChecks = 0;

    let earlyFailures = 0;
    const passRates: number[] = [];
    for (const run of runs) {
      const checks = run.results;
      if (isEarlyFailureRun(checks)) {
        earlyFailures++;
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
    const [, , runType] = name.split(' - ');

    if (runType === 'guided') {
      runs.forEach(run => {
        if (isEarlyFailureRun(run.results)) {
          return;
        }
        const guidesUsed = run.guidesUsed || [];
        const expectedGuide = run.guideName;
        if (expectedGuide && guidesUsed.includes(expectedGuide)) {
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
      passedChecks,
      totalChecks,
      earlyFailures,
      avgTokens: runsWithTokenData > 0 ? {
        total: Math.round(totalTokensForConfig / runsWithTokenData),
        cached: Math.round(cachedTokensForConfig / runsWithTokenData)
      } : undefined
    };
  }

  const uniqueTasks = new Set<string>();
  for (const name of sortedKeys) {
    uniqueTasks.add(name.replace(/ - (guided|unguided)$/, ''));
  }

  const calcSummary = (runType: 'guided' | 'unguided') => {
    const medians: number[] = [];
    let passed = 0;
    let total = 0;
    let guideUsageCount = 0;
    let toolActivationCount = 0;
    let totalGuidedRuns = 0;
    let guidedEarlyFailures = 0;
    let earlyFailures = 0;
    let totalRuns = 0;
    let totalTokens = 0;
    let cachedTokens = 0;
    let configsWithTokenData = 0;

    for (const prefix of uniqueTasks) {
      const k = `${prefix} - ${runType}`;
      const otherKey = `${prefix} - ${runType === 'guided' ? 'unguided' : 'guided'}`;
      const stats = testStats[k];
      if (!stats) continue;

      const otherStats = testStats[otherKey];
      const validPair = stats.totalChecks > 0 && (!otherStats || otherStats.totalChecks > 0);

      if (validPair) {
        passed += stats.passedChecks;
        total += stats.totalChecks;
        medians.push(stats.medianPassRate);
      }
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
        guidedEarlyFailures += stats.earlyFailures || 0;
      }
    }

    const sortedMedians = [...medians].sort((a, b) => a - b);
    const mid = Math.floor(sortedMedians.length / 2);
    const median = sortedMedians.length === 0 ? 0 :
      (sortedMedians.length % 2 === 0
        ? (sortedMedians[mid - 1] + sortedMedians[mid]) / 2
        : sortedMedians[mid]);

    const completedGuidedRuns = totalGuidedRuns - guidedEarlyFailures;

    return {
      median: Math.round(median),
      passed,
      total,
      rate: total ? Math.round((passed / total) * 100) : 0,
      guideUsageCount,
      totalGuidedRuns,
      toolActivationCount,
      earlyFailures,
      totalRuns,
      earlyFailureRate: totalRuns ? Math.round((earlyFailures / totalRuns) * 100) : 0,
      toolActivationRate: completedGuidedRuns ? Math.round((toolActivationCount / completedGuidedRuns) * 100) : 0,
      guideUsageRate: completedGuidedRuns ? Math.round((guideUsageCount / completedGuidedRuns) * 100) : 0,
      totalTokens: configsWithTokenData > 0 ? { total: totalTokens, cached: cachedTokens } : undefined
    };
  };

  const uStats = calcSummary('unguided');
  const gStats = calcSummary('guided');

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
      toolActivationRate: gStats.toolActivationRate,
      toolActivationCount: gStats.toolActivationCount,

      unguidedEarlyFailures: uStats.earlyFailures,
      unguidedEarlyFailureRate: uStats.earlyFailureRate,
      guidedEarlyFailures: gStats.earlyFailures,
      guidedEarlyFailureRate: gStats.earlyFailureRate,
      totalTokens: totalTokensSum > 0 ? { total: totalTokensSum, cached: cachedTokensSum } : undefined,
      unguidedTotalTokens: uStats.totalTokens,
      guidedTotalTokens: gStats.totalTokens
    },
    testStats,
    sortedKeys
  };
}
