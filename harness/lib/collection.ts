import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import { checkGuides } from './guide_validation.ts';
import { fileURLToPath } from 'url';
import { config } from '../config.ts';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function collectResults(resultsDir: string) {
  const runDirs = fs.readdirSync(resultsDir)
    .filter(name => {
      const fullPath = path.join(resultsDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (runDirs.length === 0) {
    throw new Error('No test runs found!');
  }

  const allResults: Record<string, any[]> = {};

  for (const runDir of runDirs) {
    const runPath = path.join(resultsDir, runDir);

    // Structure: results/{testID}/{runNumber}/{baseApp}/{runType}
    const directories = glob.sync('*/*/', {
      cwd: runPath,
      absolute: true
    });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);

      if (parts.length < 2) continue;

      const [baseApp, runType] = parts;

      let guideResults = undefined;
      if (runType === 'guided') {
        guideResults = await checkGuides(dir, baseApp);
      }

      const targetFile = path.join(dir, 'index.html');

      // Run the tests for each guide
      for (const guide of config.eval.guidesToTest) {
        const testName = `${baseApp} - ${guide} - ${runType}`;

        const guidesDir = path.resolve(__dirname, '../../guides');
        const graderMatches = glob.sync(`**/${guide}/grader.ts`, {
          cwd: guidesDir,
          absolute: true
        });
        const graderPath = graderMatches.length > 0 ? graderMatches[0] : path.join(guidesDir, guide, `grader.ts`);

        let scenarioResults: any[] = [];
        const graderResults = path.join(dir, `${guide}_results.json`);

        if (!fs.existsSync(graderPath)) {
          console.warn(`Grader not found for ${guide} at ${graderPath}`);
          scenarioResults.push({ name: 'Configuration', status: 'fail', message: 'Grader not found' });
        } else if (!fs.existsSync(targetFile)) {
          scenarioResults.push({ name: 'File Check', status: 'fail', message: 'index.html not found' });
        } else {
          try {
            let json: any = null;
            let useExistingResults = false;

            // Check if existing results are found
            if (fs.existsSync(graderResults)) {
              const answer = await promptUser(`Found existing grader results for ${testName} run ${runDir}. Re-use results? [y/n] `);
              useExistingResults = answer.toLowerCase() === 'y';
            }

            if (useExistingResults) {
              json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));
            } else {
              console.log(`Running grader for ${guide} in ${dir}...`);
              // Use spawnSync to handle exit codes without throwing
              const { spawnSync } = await import('child_process');
              const playwrightConfig = path.join(guidesDir, 'playwright.config.ts');
              const result = spawnSync('npx', ['playwright', 'test', '-c', playwrightConfig, graderPath, '--reporter=json'], {
                encoding: 'utf-8',
                stdio: 'pipe',
                env: { ...process.env, TARGET_FILE: targetFile },
                maxBuffer: 10 * 1024 * 1024 // 10MB
              });

              if (result.error) throw result.error;

              const output = result.stdout;
              json = JSON.parse(output);
              fs.writeFileSync(graderResults, JSON.stringify(json, null, 2));
            }

            if (json.suites && json.suites.length > 0) {
              const specs: any[] = [];
              const traverse = (suite: any) => {
                if (suite.specs) specs.push(...suite.specs);
                if (suite.suites) suite.suites.forEach(traverse);
              };
              json.suites.forEach(traverse);

              scenarioResults = specs.map((spec: any) => {
                const lastResult = spec.tests[0].results[spec.tests[0].results.length - 1];
                return {
                  passed: lastResult.status === 'passed',
                  message: spec.title
                };
              });
            }
          } catch (err: any) {
            console.error(`Error processing results for ${dir}:`, err);
            scenarioResults.push({ name: 'System Error', status: 'fail', message: err.message });
          }
        }

        if (!allResults[testName]) {
          allResults[testName] = [];
        }
        allResults[testName].push({
          runNumber: parseInt(runDir),
          results: scenarioResults,
          guideResults
        });
      }
    }
  }

  return { allResults, numRuns: runDirs.length };
}
