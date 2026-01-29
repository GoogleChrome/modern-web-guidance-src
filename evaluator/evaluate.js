const glob = require('glob');
const path = require('path');
const fs = require('fs');
const colors = require('colors');

const checkGreenfield = require('./checks/greenfield');
const checkBrownfield = require('./checks/brownfield');
const checkRedfield = require('./checks/redfield');

async function main() {
  console.log('Starting Static Evaluation...'.cyan.bold);

  // Read manifest to find the latest test
  const manifestPath = 'results/tests.json';
  if (!fs.existsSync(manifestPath)) {
    console.error('Manifest file not found at results/tests.json!'.red);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.error('Failed to parse manifest!'.red);
    return;
  }

  if (!manifest.tests || manifest.tests.length === 0) {
    console.error('No tests found in manifest!'.red);
    return;
  }

  // Get the latest test
  const latestTest = manifest.tests[manifest.tests.length - 1];
  const testID = latestTest.id;
  const resultsDir = path.join('results', testID);

  console.log(`Evaluating test: ${testID}`.cyan);
  console.log(`Results directory: ${resultsDir}`.cyan);

  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory not found at ${resultsDir}!`.red);
    return;
  }

  const runDirs = fs.readdirSync(resultsDir)
    .filter(name => {
      const fullPath = path.join(resultsDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (runDirs.length === 0) {
    console.error('No test runs found!'.red);
    return;
  }

  console.log(`Found ${runDirs.length} test run(s)`.cyan);

  // Store results by test name, with each run's results
  const allResults = {};

  for (const runDir of runDirs) {
    console.log(`\n${'='.repeat(60)}`.cyan);
    console.log(`Evaluating Run ${runDir}`.cyan.bold);
    console.log(`${'='.repeat(60)}`.cyan);

    const runPath = path.join(resultsDir, runDir);
    
    // Find all leaf directories with an index.html or just strict structure
    // Structure: results/{testID}/{runNumber}/{scenario}/{type}/{agent}
    const directories = glob.sync('*/*/*/', {
      cwd: runPath,
      absolute: true
    });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);

      if (parts.length < 3) continue;

      const [scenario, promptType, agentType] = parts;
      const testName = `${scenario} - ${promptType} - ${agentType}`;

      console.log(`Evaluating: ${testName}`.yellow);

      // Use glob to recursively find all files (nodir: true skips directories themselves)
      const files = glob.sync('**/*', { cwd: dir, nodir: true });

      let scenarioResults = [];

      if (scenario === 'greenfield') {
        scenarioResults = checkGreenfield(dir, files);
      } else if (scenario === 'brownfield') {
        scenarioResults = checkBrownfield(dir, files);
      } else if (scenario === 'redfield') {
        scenarioResults = checkRedfield(dir, files);
      } else {
        console.log(`Unknown scenario type: ${scenario}`.red);
        continue;
      }

      if (!allResults[testName]) {
        allResults[testName] = [];
      }
      allResults[testName].push({
        runNumber: parseInt(runDir),
        results: scenarioResults
      });
    }
  }

  generateReport(allResults, runDirs.length, testID);
}

function generateReport(allResults, numRuns, testID) {
  let md = '# Evaluation Results\n\n';

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

  const calculateMedian = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  const unguidedMedian = Math.round(calculateMedian(unguidedMedians));
  const guidedMedian = Math.round(calculateMedian(guidedMedians));

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

  const summary = `
| Group | Pass Rate | Test Runs |
|---|---|---|
| **Unguided** | ${unguidedRate}% (${unguidedPassed}/${unguidedTotal}) | ${numRuns} |
| **Guided** | ${guidedRate}% (${guidedPassed}/${guidedTotal}) | ${numRuns} |

`;

  md += summary;

  // Generate detailed sections for each test
  for (const name of sortedKeys) {
    const runs = allResults[name];
    const stats = testPassRates[name];
    
    md += `## ${name.toUpperCase()} (Median: ${stats.median}%)\n\n`;
    md += `**Pass rates across runs:** ${stats.rates.join('%, ')}%\n\n`;

    // Show the median run's detailed results
    const medianRunIndex = runs.findIndex(run => {
      const checks = run.results;
      const passCount = checks.filter(c => c.passed).length;
      const totalCount = checks.length;
      const rate = Math.round((passCount / totalCount) * 100);
      return rate === stats.median;
    });

    const displayRun = medianRunIndex >= 0 ? runs[medianRunIndex] : runs[0];
    const checks = displayRun.results;
    const groupPass = checks.filter(c => c.passed).length;
    const groupTotal = checks.length;

    md += `### Run ${displayRun.runNumber} Details (${groupPass}/${groupTotal})\n\n`;

    const tableHeader = '| Status | Expectation |\n|---|---|\n';
    let tableRows = '';

    checks.forEach(check => {
      const symbol = check.passed ? '✅' : '❌';
      const safeMessage = check.message.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      tableRows += `| ${symbol} | ${safeMessage} |\n`;
    });

    md += tableHeader + tableRows + '\n';
  }

  const resultsDir = path.join('results', testID);
  fs.mkdirSync(resultsDir, { recursive: true });

  fs.writeFileSync(path.join(resultsDir, 'evals.md'), md);
  console.log(`\nReport generated: ${path.resolve(path.join(resultsDir, 'evals.md'))}`.green.bold);
  console.log(`Pass Rate - Unguided: ${unguidedRate}%, Guided: ${guidedRate}%`.cyan);

  const jsonOutput = {
    summary: {
      unguidedMedian,
      guidedMedian,
      unguidedPassRate: unguidedRate,
      guidedPassRate: guidedRate,
      numRuns
    },
    results: allResults,
    stats: testPassRates
  };

  fs.writeFileSync(path.join(resultsDir, 'evals.json'), JSON.stringify(jsonOutput, null, 2));
  console.log(`JSON Report generated: ${path.resolve(path.join(resultsDir, 'evals.json'))}`.green.bold);
}

main().catch(console.error);
