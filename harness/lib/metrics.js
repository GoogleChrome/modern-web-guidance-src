export function calculateMetrics(allResults, numRuns) {
  const scenarioOrder = { 'greenfield': 1, 'brownfield': 2, 'redfield': 3 };
  const promptOrder = { 'vague': 1, 'specific': 2 };
  const agentOrder = { 'unguided': 1, 'guided': 2 };

  const sortedKeys = Object.keys(allResults).sort((a, b) => {
    const [scenA, promptA, agentA] = a.split(' - ');
    const [scenB, promptB, agentB] = b.split(' - ');

    if (scenA !== scenB) {
      return (scenarioOrder[scenA] || 99) - (scenarioOrder[scenB] || 99);
    }
    if (promptA !== promptB) {
      return (promptOrder[promptA] || 99) - (promptOrder[promptB] || 99);
    }
    return (agentOrder[agentA] || 99) - (agentOrder[agentB] || 99);
  });

  // Calculate pass rates for each test across all runs
  const testPassRates = {};
  for (const name of sortedKeys) {
    const runs = allResults[name];
    const passRates = runs.map(run => {
      const checks = run.results;
      const passCount = checks.filter(c => c.passed).length;
      const totalCount = checks.length;
      return totalCount > 0 ? (passCount / totalCount) * 100 : 0;
    }).sort((a, b) => a - b);
    
    // Calculate median
    const mid = Math.floor(passRates.length / 2);
    const median = passRates.length % 2 === 0 
      ? (passRates[mid - 1] + passRates[mid]) / 2 
      : passRates[mid];
    
    testPassRates[name] = {
      median: Math.round(median),
      rates: passRates.map(r => Math.round(r))
    };
  }

  // Calculate overall statistics (Median)
  let guidedMedians = [];
  let unguidedMedians = [];
  
  for (const [name, stats] of Object.entries(testPassRates)) {
    if (name.includes(' - guided')) {
      guidedMedians.push(stats.median);
    }
    if (name.includes(' - unguided')) {
      unguidedMedians.push(stats.median);
    }
  }

  const calculateMedianFunc = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  const unguidedMedian = Math.round(calculateMedianFunc(unguidedMedians));
  const guidedMedian = Math.round(calculateMedianFunc(guidedMedians));

  // Calculate total pass rates (Weighted/True Average)
  let unguidedPassed = 0;
  let unguidedTotal = 0;
  let guidedPassed = 0;
  let guidedTotal = 0;

  for (const name of sortedKeys) {
    const runs = allResults[name];
    runs.forEach(run => {
      const checks = run.results;
      const passCount = checks.filter(c => c.passed).length;
      const totalCount = checks.length;

      if (name.includes(' - unguided')) {
        unguidedPassed += passCount;
        unguidedTotal += totalCount;
      } else if (name.includes(' - guided')) {
        guidedPassed += passCount;
        guidedTotal += totalCount;
      }
    });
  }

  const unguidedRate = unguidedTotal > 0 ? Math.round((unguidedPassed / unguidedTotal) * 100) : 0;
  const guidedRate = guidedTotal > 0 ? Math.round((guidedPassed / guidedTotal) * 100) : 0;

  return {
    summary: {
      unguidedMedian,
      guidedMedian,
      unguidedPassRate: unguidedRate,
      guidedPassRate: guidedRate,
      unguidedPassed,
      unguidedTotal,
      guidedPassed,
      guidedTotal,
      numRuns
    },
    testPassRates,
    sortedKeys
  };
}
