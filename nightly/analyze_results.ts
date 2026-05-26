import fs from 'fs';

interface ScenarioCheck {
  passed: boolean;
  message?: string;
  isEarlyFailure?: boolean;
}

interface Run {
  runNumber: number;
  results?: ScenarioCheck[];
}

interface EvalsReport {
  results?: Record<string, Run[]>;
}

interface GenerationError {
  testName: string;
  runNumber: number;
  message: string;
}

function main(): void {
  const args = process.argv.slice(2);
  const evalsJsonPath = args[0];
  const outputFormat = args[1] || 'json'; // 'json', 'text', 'has-data', 'errors-count', 'is-catastrophic-failure'

  if (!evalsJsonPath) {
    console.error('Usage: node --experimental-strip-types analyze_results.ts <path-to-evals.json> [format]');
    process.exit(1);
  }

  if (!fs.existsSync(evalsJsonPath)) {
    if (outputFormat === 'has-data') {
      console.log('false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log('false');
    } else if (outputFormat === 'errors-count') {
      console.log('0');
    } else if (outputFormat === 'text') {
      console.log('❌ Error: evals.json does not exist.');
    } else {
      console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: 'evals.json does not exist', generationErrors: [] }));
    }
    process.exit(0);
  }

  try {
    const content = fs.readFileSync(evalsJsonPath, 'utf8');
    const data = JSON.parse(content) as EvalsReport;

    const results = data.results || {};
    const testNames = Object.keys(results);

    if (testNames.length === 0) {
      if (outputFormat === 'has-data') {
        console.log('false');
      } else if (outputFormat === 'is-catastrophic-failure') {
        console.log('false');
      } else if (outputFormat === 'errors-count') {
        console.log('0');
      } else if (outputFormat === 'text') {
        console.log('⚠️ No evaluation data was generated (0 tasks were run).');
      } else {
        console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: 'No tasks were run', generationErrors: [] }));
      }
      process.exit(0);
    }

    const generationErrors: GenerationError[] = [];
    let totalRunsCount = 0;
    let earlyFailuresCount = 0;

    for (const testName of testNames) {
      const runs = results[testName] || [];
      for (const run of runs) {
        totalRunsCount++;
        const scenarioChecks = run.results || [];
        let runHasEarlyFailure = false;
        for (const check of scenarioChecks) {
          if (check.isEarlyFailure) {
            runHasEarlyFailure = true;
            generationErrors.push({
              testName,
              runNumber: run.runNumber,
              message: check.message || 'Unknown generation error'
            });
          }
        }
        if (runHasEarlyFailure) {
          earlyFailuresCount++;
        }
      }
    }

    const hasData = totalRunsCount > 0;
    const isCatastrophicFailure = totalRunsCount > 0 && earlyFailuresCount === totalRunsCount;

    if (outputFormat === 'has-data') {
      console.log(hasData ? 'true' : 'false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log(isCatastrophicFailure ? 'true' : 'false');
    } else if (outputFormat === 'errors-count') {
      console.log(String(generationErrors.length));
    } else if (outputFormat === 'text') {
      if (generationErrors.length > 0) {
        let text = `❌ Generation Errors (Total: ${generationErrors.length}):\n\n`;
        
        // Group errors by their message
        const groups: Record<string, GenerationError[]> = {};
        for (const err of generationErrors) {
          if (!groups[err.message]) {
            groups[err.message] = [];
          }
          groups[err.message].push(err);
        }

        // Output each error group cleanly
        for (const [message, errList] of Object.entries(groups)) {
          text += `  ● "${message}" (occurred on ${errList.length} tasks):\n`;
          
          const maxVisible = 10;
          const visibleList = errList.slice(0, maxVisible);
          visibleList.forEach((err, idx) => {
            text += `    ${idx + 1}. Run ${err.runNumber} - ${err.testName}\n`;
          });

          if (errList.length > maxVisible) {
            text += `    ... and ${errList.length - maxVisible} more tasks experienced this error.\n`;
          }
          text += `\n`;
        }
        
        console.log(text.trimEnd());
      } else {
        console.log('✅ No generation errors detected.');
      }
    } else {
      console.log(JSON.stringify({ hasData, isCatastrophicFailure, generationErrors }, null, 2));
    }

  } catch (err: any) {
    if (outputFormat === 'has-data') {
      console.log('false');
    } else if (outputFormat === 'is-catastrophic-failure') {
      console.log('false');
    } else if (outputFormat === 'errors-count') {
      console.log('0');
    } else if (outputFormat === 'text') {
      console.log(`❌ Error processing results: ${err.message}`);
    } else {
      console.log(JSON.stringify({ hasData: false, isCatastrophicFailure: false, error: `Failed to parse results: ${err.message}`, generationErrors: [] }));
    }
  }
}

main();
