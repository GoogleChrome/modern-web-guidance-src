import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import { guideUsed } from './guide_validation.ts';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // --- PASS 1: Generate parallel grader scripts for missing results ---
  const pnpmWorkspacePackages: string[] = [];
  const { spawnSync } = await import('child_process');

  for (const runDir of runDirs) {
    const runPath = path.join(resultsDir, runDir);
    const directories = glob.sync('*/*/', { cwd: runPath, absolute: true });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);
      if (parts.length < 2) continue;

      const [taskName, runType] = parts;
      const targetFile = path.join(dir, 'index.html');
      
      const taskPath = path.resolve(__dirname, `../tasks/${taskName}.md`);
      if (!fs.existsSync(taskPath)) continue;

      const fileContent = fs.readFileSync(taskPath, 'utf8');
      const { data } = matter(fileContent);
      if (!data || !data.grader) continue;

      const guide = data.grader.trim();
      const guidesDir = path.resolve(__dirname, '../../guides');
      const graderMatches = glob.sync(`**/${guide}/grader.ts`, { cwd: guidesDir, absolute: true });
      const graderPath = graderMatches.length > 0 ? graderMatches[0] : path.join(guidesDir, guide, `grader.ts`);
      
      const graderResults = path.join(dir, `${guide}_results.json`);

      // If grader is missing, target file is missing, or results already exist, skip generating a runner.
      if (!fs.existsSync(graderPath) || !fs.existsSync(targetFile) || fs.existsSync(graderResults)) {
        continue;
      }

      // Generate a runner script to be picked up by pnpm -r run-grader
      // We import runPlaywright directly from the guides code to leverage existing test execution logic
      const runGraderModulePath = path.resolve(__dirname, '../../guides/run-grader.ts');
      const gradeScript = `
import fs from 'fs';
import { runPlaywright } from ${JSON.stringify(runGraderModulePath)};

async function run() {
  try {
    const json = await runPlaywright(
      ${JSON.stringify(targetFile)},
      ${JSON.stringify(graderPath)},
      ${JSON.stringify(path.join(dir, 'grade-report'))},
      'inherit'
    );
    fs.writeFileSync(${JSON.stringify(graderResults)}, JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Playwright test execution failed:", err);
    process.exit(1); 
  }
}

run();
      `.trim();

      const relativeId = path.relative(resultsDir, dir);
      fs.writeFileSync(path.join(dir, 'grade.mjs'), gradeScript);
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
        name: `${taskName.substring(0, 30)}-${runType}-grader`,
        type: "module",
        scripts: { 
          // The --id flag is not used by grade.mjs, it is purely added here 
          // so that the pnpm log output clearly identifies which test is running.
          "run-grader": `node grade.mjs --id ${relativeId}` 
        }
      }, null, 2));

      // path.relative(resultsDir, dir) gives e.g. "1/taskName/guided"
      pnpmWorkspacePackages.push(relativeId);
    }
  }

  // --- PASS 1.5: Execute the accumulated grading runs in parallel ---
  if (pnpmWorkspacePackages.length > 0) {
    console.log(`\n>>> Discovered ${pnpmWorkspacePackages.length} un-graded tasks. Running parallel grading with pnpm -r run-grader...`);
    const pnpmWorkspacePath = path.join(resultsDir, 'pnpm-workspace.yaml');
    fs.writeFileSync(pnpmWorkspacePath, 'packages:\n  - \'**\'\n');
    try {
      spawnSync('pnpm', ['-r', 'run-grader'], { cwd: resultsDir, stdio: 'inherit' });
    } finally {
      if (fs.existsSync(pnpmWorkspacePath)) {
        fs.unlinkSync(pnpmWorkspacePath);
      }
    }
    console.log(`✅ Completed parallel grading pass\n`);
  }

  // --- PASS 2: Collect all results and formulate the report ---
  const allResults: Record<string, any[]> = {};

  for (const runDir of runDirs) {
    const runPath = path.join(resultsDir, runDir);

    // Structure: results/{suiteName}/{runNumber}/{taskName}/{runType}
    const directories = glob.sync('*/*/', {
      cwd: runPath,
      absolute: true
    });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);

      if (parts.length < 2) continue;

      const [taskName, runType] = parts;

      let guideUsedResult = undefined;
      if (runType === 'guided') {
        guideUsedResult = await guideUsed(dir, taskName);
      }

      const targetFile = path.join(dir, 'index.html');

      const taskPath = path.resolve(__dirname, `../tasks/${taskName}.md`);
      if (!fs.existsSync(taskPath)) {
        console.warn(`Skipping grading: Task ${taskName} not found at ${taskPath}`);
        continue;
      }

      const fileContent = fs.readFileSync(taskPath, 'utf8');
      const { data } = matter(fileContent);

      if (!data || !data.grader) {
         continue;
      }

      const guide = data.grader.trim();

      const actualBaseApp = data.base_app ? data.base_app.trim() : taskName;

      const testName = `${taskName} - ${guide} - ${runType}`;

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

          if (fs.existsSync(graderResults)) {
            try {
              json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));
            } catch (e) {
              console.error(`Error parsing JSON results for ${guide} in ${dir}`, e);
            }
          } else {
            console.error(`Missing grader results JSON for ${guide} in ${dir}`);
          }

          if (json && json.suites && json.suites.length > 0) {
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
        guideUsed: guideUsedResult,
        baseApp: actualBaseApp,
        taskName: taskName
      });
    }
  }

  return { allResults, numRuns: runDirs.length };
}
