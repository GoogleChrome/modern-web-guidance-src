import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import { collectGuidesUsed, collectGuidanceToolsUsed } from './guidance_validation.ts';
import { Agents, type SuiteConfig } from '../config.ts';
import { guidesDir } from '../../lib/paths.ts';
import { getTaskMap } from '../../lib/guide-validation.ts';
import { extractGeminiCliModel } from '../agents/gemini-cli-agent.ts';
import { extractClaudeCodeModel } from '../agents/claude-code-agent.ts';
import { extractCodexCliModel } from '../agents/codex-cli-agent.ts';

function isTargetAppPresent(targetFile: string, targetPkgJson: string): boolean {
  return fs.existsSync(targetFile) || fs.existsSync(targetPkgJson);
}

export function extractModelFromResults(resultsDir: string, agent: string): string {
  if (agent === Agents.GEMINI_CLI) {
    return extractGeminiCliModel(resultsDir);
  } else if (agent === Agents.CLAUDE_CODE) {
    return extractClaudeCodeModel(resultsDir);
  } else if (agent === Agents.CODEX_CLI) {
    return extractCodexCliModel(resultsDir);
  }
  // JETSKI impl does not support trajectory pb parsing, leave model as unknown
  return 'unknown';
}

function extractErrorMessage(dir: string, targetFile: string): string {
  const failureFile = path.join(dir, 'generation_failed.json');
  if (fs.existsSync(failureFile)) {
    try {
      const failureInfo = JSON.parse(fs.readFileSync(failureFile, 'utf-8'));
      return `Generation failed: ${failureInfo.agentName} exited with ${failureInfo.exitCode}`;
    } catch (e) {
      return 'Generation failed (could not parse failure info)';
    }
  }

  const stderrPath = path.join(dir, 'agent_stderr.log');
  
  if (!fs.existsSync(stderrPath)) {
    return fs.existsSync(targetFile) ? 'Generation failed' : 'index.html not found';
  }

  return fs.readFileSync(stderrPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.includes('YOLO mode'))
    .pop()?.slice(0, 100) || 'Generation mysteriously failed';
}

export async function collectResults(resultsDir: string, suiteConfig: SuiteConfig) {
  const taskMap = getTaskMap();

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
    const runTypeDirs = [
      ...glob.sync('**/guided', { cwd: runPath, absolute: true }),
      ...glob.sync('**/unguided', { cwd: runPath, absolute: true })
    ];

    for (const dir of runTypeDirs) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);
      
      let guide: string, taskName: string, runType: string;
      if (parts.length === 2) {
        // [Legacy Fallback] Old structure: {taskName}/{runType}
        taskName = 'task'; // Old suites always had a single task
        runType = parts[1];
        guide = parts[0].replace(/-task$/, ''); // Infer guide name by removing suffix
      } else if (parts.length >= 3) {
        [guide, taskName, runType] = parts;
      } else {
        continue;
      }
      if (runType === 'base_app') continue; // Skip the base app setup folder
      const targetFile = path.join(dir, 'index.html');
      const targetPkgJson = path.join(dir, 'package.json');

      const taskInfo = taskMap.get(`${guide}/${taskName}`);
      if (!taskInfo) continue;

      const graderPath = path.join(taskInfo.guideDir, 'grader.ts');
      const graderResults = path.join(dir, `${guide}_results.json`);

      const targetAppExists = isTargetAppPresent(targetFile, targetPkgJson);

      const failureFile = path.join(dir, 'generation_failed.json');
      // If grader is missing, generation failed, target file is missing, or results already exist, skip generating a runner.
      if (!fs.existsSync(graderPath) || fs.existsSync(failureFile) || !targetAppExists || fs.existsSync(graderResults)) {
        continue;
      }

      // Generate a runner script to be picked up by pnpm -r run-grader
      // We import runPlaywright directly from the guides code to leverage existing test execution logic
      const runGraderModulePath = path.join(guidesDir, 'run-grader.ts');
      const gradeScript = `
import fs from 'fs';
import { spawnSync } from 'child_process';
import { spawnSync } from 'child_process';
import { runPlaywright } from ${JSON.stringify(runGraderModulePath)};

async function run() {
  try {
    const pkgJsonPath = ${JSON.stringify(targetPkgJson)};
    if (fs.existsSync(pkgJsonPath)) {
      const installResult = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--ignore-workspace'], {
        cwd: ${JSON.stringify(dir)},
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, CI: 'true' }
      });
      if (installResult.status !== 0) {
        console.error("pnpm install failed");
        process.exit(1);
      }
    }

    const pkgJsonPath = ${JSON.stringify(targetPkgJson)};
    if (fs.existsSync(pkgJsonPath)) {
      const installResult = spawnSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--ignore-workspace'], {
        cwd: ${JSON.stringify(dir)},
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, CI: 'true' }
      });
      if (installResult.status !== 0) {
        console.error("pnpm install failed");
        process.exit(1);
      }
    }

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
      const relativeId = path.relative(resultsDir, dir); // e.g. "1/guideName/guided"
      fs.writeFileSync(path.join(dir, 'grade.mjs'), gradeScript);
      let pkgJsonObj: any = {
        name: `${guide.substring(0, 30)}-${runType}-grader`,
        type: "module",
        scripts: {}
      };
      if (fs.existsSync(targetPkgJson)) {
        try {
          pkgJsonObj = JSON.parse(fs.readFileSync(targetPkgJson, 'utf-8'));
          if (!pkgJsonObj.scripts) pkgJsonObj.scripts = {};
        } catch (e) {
          console.warn("Failed to parse existing package.json, overwriting...");
        }
      }
      pkgJsonObj.scripts["run-grader"] = `node grade.mjs --id ${relativeId}`;
      fs.writeFileSync(targetPkgJson, JSON.stringify(pkgJsonObj, null, 2));

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

    const runTypeDirs = [
      ...glob.sync('**/guided', { cwd: runPath, absolute: true }),
      ...glob.sync('**/unguided', { cwd: runPath, absolute: true })
    ];

    for (const dir of runTypeDirs) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);
      
      let guide: string, taskName: string, runType: string;
      if (parts.length === 2) {
        // [Legacy Fallback] Old structure: {taskName}/{runType}
        taskName = 'task';
        runType = parts[1];
        guide = parts[0].replace(/-task$/, '');
      } else if (parts.length >= 3) {
        [guide, taskName, runType] = parts;
      } else {
        continue;
      }
      if (runType === 'base_app') continue; // Skip the base app setup folder
      let guidesUsedResult: string[] = [];
      let retrievedGuides: string[] = [];
      let fileReadGuides: string[] = [];
      let guidanceToolsUsedResult: string[] = [];

      if (runType === 'guided') {
        const serving = suiteConfig.serving;
        const usage = await collectGuidesUsed(dir, serving, suiteConfig.agent);
        retrievedGuides = usage.retrievedGuides;
        fileReadGuides = usage.fileReadGuides;
        guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides])];
        guidanceToolsUsedResult = await collectGuidanceToolsUsed(dir, serving, suiteConfig.agent);
      }

      const targetFile = path.join(dir, 'index.html');
      const targetPkgJson = path.join(dir, 'package.json');
      const taskInfo = taskMap.get(`${guide}/${taskName}`);
      if (!taskInfo) {
        console.warn(`Skipping grading: Task ${guide} not found in task map`);
        continue;
      }
      const taskCategory = path.basename(path.dirname(taskInfo.guideDir));
      const expectedToolPrefixes = ['modern-web', taskCategory].filter(Boolean);

      const graderPath = path.join(taskInfo.guideDir, 'grader.ts');

      let scenarioResults: any[] = [];
      const graderResults = path.join(dir, `${guide}_results.json`);

      const targetAppExists = isTargetAppPresent(targetFile, targetPkgJson);

      if (!fs.existsSync(graderPath)) {
        console.warn(`Grader not found for ${guide} at ${graderPath}`);
        scenarioResults.push({ name: 'Configuration', status: 'fail', message: 'Grader not found' });
      } else if (!targetAppExists) {
        scenarioResults.push({ name: 'File Check', status: 'fail', message: 'Target app missing' });
      } else if (!fs.existsSync(graderResults)) {
        const errorMessage = extractErrorMessage(dir, targetFile);
        scenarioResults.push({ passed: false, message: errorMessage, isEarlyFailure: true });
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

      const testName = `${taskName} - ${guide} - ${runType}`;
      const actualBaseApp = taskInfo.baseApp;

      if (!allResults[testName]) {
        allResults[testName] = [];
      }
      allResults[testName].push({
        runNumber: parseInt(runDir),
        results: scenarioResults,
        guidesUsed: guidesUsedResult,
        retrievedGuides: retrievedGuides,
        fileReadGuides: fileReadGuides,
        guidanceToolsUsed: guidanceToolsUsedResult,
        expectedToolPrefixes: expectedToolPrefixes,
        guideName: guide,
        taskName: taskName,
        baseApp: actualBaseApp,
        prompt: taskInfo.prompt
      });
    }
  }

  return { allResults, numRuns: runDirs.length };
}
