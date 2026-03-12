export interface ScenarioCheck {
  id: string;
  passed: boolean;
  message: string;
}

export interface RunResult {
  runNumber: number;
  results: ScenarioCheck[];
  guidesUsed?: string[];
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
    guideUsageRate?: number;
    guideUsageCount?: number;
    totalGuidedRuns?: number;
  };
  testStats: Record<string, {
    medianPassRate: number;
    runPassRates: number[];
    runsUsingGuide?: number;
    runCount?: number;
    passedChecks: number;
    totalChecks: number;
  }>;
  sortedKeys: string[];
}

export function calculateMetrics(allResults: Record<string, RunResult[]>, runsPerTest: number): Metrics {
  // Dynamic sorting: Tasks alphabetically, then Guides alphabetically, then Run Type (unguided first if present)
  const runTypeOrder: Record<string, number> = { 'unguided': 1, 'guided': 2 };

  const sortedKeys = Object.keys(allResults).sort((a, b) => {
    const [taskA, guideA, runTypeA] = a.split(' - ');
    const [taskB, guideB, runTypeB] = b.split(' - ');

    if (taskA !== taskB) {
      return taskA.localeCompare(taskB);
    }
    if (guideA !== guideB) {
      return guideA.localeCompare(guideB);
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
    runCount?: number;
    passedChecks: number;
    totalChecks: number;
  }> = {};

  for (const name of sortedKeys) {
    const runs = allResults[name];
    let passedChecks = 0;
    let totalChecks = 0;

    const passRates = runs.map(run => {
      const checks = run.results;
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
    const [, guide, runType] = name.split(' - ');

    if (runType === 'guided') {
      runs.forEach(run => {
        const guidesUsed = run.guidesUsed || [];
        if (guidesUsed.includes(guide)) {
          guideUsageCount++;
        }
      });
    }

    testStats[name] = {
      medianPassRate: Math.round(median),
      runPassRates: passRates.map(r => Math.round(r)),
      runsUsingGuide: runType === 'guided' ? guideUsageCount : undefined,
      runCount: runs.length,
      passedChecks,
      totalChecks
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
    let totalGuidedRuns = 0;

    keys.forEach(k => {
      const [, , runType] = k.split(' - ');
      const stats = testStats[k];

      if (stats) {
        passed += stats.passedChecks;
        total += stats.totalChecks;

        if (runType === 'guided') {
          guideUsageCount += stats.runsUsingGuide || 0;
          totalGuidedRuns += stats.runCount || 0;
        }
      }
    });

    return {
      median: Math.round(median),
      passed,
      total,
      rate: total ? Math.round((passed / total) * 100) : 0,
      guideUsageCount,
      totalGuidedRuns,
      guideUsageRate: totalGuidedRuns ? Math.round((guideUsageCount / totalGuidedRuns) * 100) : 0
    };
  };

  const uStats = calcSummary(sortedKeys.filter(k => k.includes(' - unguided')));
  const gStats = calcSummary(sortedKeys.filter(k => k.includes(' - guided')));

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
      guideUsageRate: gStats.guideUsageRate,
      guideUsageCount: gStats.guideUsageCount,
      totalGuidedRuns: gStats.totalGuidedRuns
    },
    testStats,
    sortedKeys
  };
}
