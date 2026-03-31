import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import { collectGuidesUsed, collectGuidanceToolsUsed } from './guidance_validation.ts';
import { Serving, Agents, type SuiteConfig } from '../config.ts';
import { guidesDir } from '../../lib/paths.ts';
import { getTaskMap } from '../../lib/guide-validation.ts';
import { extractGeminiCliModel } from '../agents/gemini-cli-agent.ts';
import { extractClaudeCodeModel } from '../agents/claude-code-agent.ts';
import { extractCodexCliModel } from '../agents/codex-cli-agent.ts';

export function getGuideCategory(guideName: string): string | null {
  const categories = fs.readdirSync(guidesDir).filter(f => fs.statSync(path.join(guidesDir, f)).isDirectory());
  
  for (const cat of categories) {
    if (fs.existsSync(path.join(guidesDir, cat, guideName))) {
      return cat;
    }
  }
  return null;
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


export async function collectResults(resultsDir: string, suiteConfig: SuiteConfig) {
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

      const [guide, runType] = parts;
      if (runType === 'base_app') continue; // Skip the base app setup folder
      const targetFile = path.join(dir, 'index.html');
      const taskMap = getTaskMap();
      const taskInfo = taskMap.get(guide);
      if (!taskInfo) continue;

      const graderMatches = glob.sync(`**/${guide}/grader.ts`, { cwd: guidesDir, absolute: true });
      const graderPath = graderMatches.length > 0 ? graderMatches[0] : path.join(guidesDir, guide, `grader.ts`);
      const graderResults = path.join(dir, `${guide}_results.json`);

      if (!fs.existsSync(graderPath) || !fs.existsSync(targetFile) || fs.existsSync(graderResults)) {
        continue;
      }

      const runGraderModulePath = path.join(guidesDir, 'run-grader.ts');
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
        name: `${guide.substring(0, 30)}-${runType}-grader`,
        type: "module",
        scripts: {
          "run-grader": `node grade.mjs --id ${relativeId}`
        }
      }, null, 2));

      pnpmWorkspacePackages.push(relativeId);
    }
  }

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
    const directories = glob.sync('*/*/', { cwd: runPath, absolute: true });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);
      if (parts.length < 2) continue;

      const [guide, runType] = parts;
      if (runType === 'base_app') continue; // Skip the base app setup folder
      let guidesUsedResult: string[] = [];
      let guidanceToolsUsedResult: string[] = [];

      if (runType === 'guided') {
        const serving = suiteConfig.serving;
        guidesUsedResult = await collectGuidesUsed(dir, serving, suiteConfig.agent);
        guidanceToolsUsedResult = await collectGuidanceToolsUsed(dir, serving, suiteConfig.agent);
      }

      const targetFile = path.join(dir, 'index.html');
      const isNegative = suiteConfig.negative === true;
      const taskMap = getTaskMap();
      const taskInfo = taskMap.get(guide);
      if (!taskInfo) {
        console.warn(`Skipping grading: Task ${guide} not found in task map`);
        continue;
      }

      const actualBaseApp = isNegative ? 'negative-demo.html' : taskInfo.baseApp;
      const taskCategory = getGuideCategory(guide);

      let expectedGuidanceTool: string | undefined;
      const serving = suiteConfig.serving;
      if (serving === Serving.MCP || suiteConfig.agent === Agents.JETSKI) {
        expectedGuidanceTool = 'modern-web';
      } else if (serving === Serving.SKILLS_CLI) {
        expectedGuidanceTool = 'modern-web-use-cases';
      } else if (serving === Serving.SKILLS) {
        expectedGuidanceTool = taskCategory || undefined;
      }

      const testName = `${guide} - ${runType}`;
      const graderMatches = glob.sync(`**/${guide}/grader.ts`, { cwd: guidesDir, absolute: true });
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
        guidesUsed: guidesUsedResult,
        guidanceToolsUsed: guidanceToolsUsedResult,
        expectedGuidanceTool: expectedGuidanceTool,
        guideName: guide,
        baseApp: actualBaseApp,
        prompt: taskInfo.prompt
      });
    }
  }

  return { allResults, numRuns: runDirs.length };
}
