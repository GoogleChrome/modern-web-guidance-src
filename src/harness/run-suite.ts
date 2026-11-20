import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawn, spawnSync } from 'child_process';
import { Agents, defaultJobConfig, mergeJobConfig, type JobConfig } from './config.ts';
import { evaluateJob } from './evaluate.ts';
import { baseAppsDir, rootDir, suitesDir } from '../core/paths.ts';
import { getTaskMap, resolveTaskGraderPath, ZERO_PASSRATE_PATCH_FILE, type TaskInfo } from '../core/guide-validation.ts';
import { applyPatchSync, initGitRepo } from '../core/patch-utils.ts';
import { getGraderScriptContent, ISOLATED_HOME_ENV } from './lib/agent-shared.ts';
import { ensureGuidedEvalDist } from './lib/eval-dist.ts';
import {
  ALLOWED_ENV_PREFIXES,
  ALLOWED_GRADER_ENV_KEYS,
  ALLOWED_WRAPPER_ENV_KEYS,
  filterAllowedEnv,
  loadAllowedEnvFile,
} from './lib/secret-guard.ts';
import { ensureFreshHostCodexAuth } from './agents/codex-cli-agent.ts';
import { copyBaseAppToWorkspace } from './lib/utils.ts';
import { determineAgent } from '../cli/telemetry/detect-agent.ts';

const CONDITIONS = ['guided', 'unguided'];

// Global log file stream
let logStream: fs.WriteStream | null = null;


const COMMON_APPEND_PROMPT = `\n\nDon't bother doing any manual verification in a browser, do NOT ask clarifying questions (make reasonable assumptions and proceed non-interactively), and do NOT start dev/preview servers or import server entrypoints (e.g., npm run dev, astro preview, or dist/server/entry.mjs)—only run build scripts if needed. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

export async function runSingleTask(baseAppDirRaw: string, promptContentRaw: string, providedJobConfig?: JobConfig) {
  const jobConfig = providedJobConfig || defaultJobConfig;
  const agent = jobConfig.agent;
  let baseAppDir = baseAppDirRaw;
  if (!path.isAbsolute(baseAppDir)) {
    baseAppDir = path.resolve(process.cwd(), baseAppDir);
  }
  const cleanBaseAppDir = baseAppDir.replace(/\/$/, '');
  const targetDir = path.join(path.dirname(cleanBaseAppDir), path.basename(cleanBaseAppDir) + '-results');
  const taskNameLabel = "Agent Test";
  const promptContent = promptContentRaw + COMMON_APPEND_PROMPT;

  if (!fs.existsSync(baseAppDir)) {
    console.error(`❌ Base app directory not found: ${baseAppDir}`);
    return;
  }

  await ensureGuidedEvalDist();

  console.log(`\n=== Running ${taskNameLabel} ===`);
  console.log(`Agent: ${agent}`);
  console.log(`Base app: ${baseAppDir}`);
  console.log(`Target: ${targetDir}\n`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Save a snapshot of the current global configuration (which may have been merged with overrides)
  fs.writeFileSync(path.join(targetDir, 'suite_config.json'), JSON.stringify(jobConfig, null, 2));

  try {
    const agentScript = getAgentScript(agent);

    const jobConfigPath = path.resolve(targetDir, 'suite_config.json');
    await runCommand('node', [
      agentScript,
      JSON.stringify(promptContent),
      'guided', // Default to guided for ad-hoc tool execution
      targetDir,
      baseAppDir
    ], { GD_SUITE_CONFIG: jobConfigPath, ENABLE_FILE_LOGGING: 'true' });
    console.log(`\n✅ ${taskNameLabel} complete! Results in ${targetDir}`);
  } catch (error) {
    console.error(`❌ ${taskNameLabel} failed:`, error);
  }
}

export interface RunJobOptions {
  name?: string;
  outputDir?: string;
  tasks?: string[];
  numRuns?: number;
  skipEval?: boolean;
  skipSkillBuild?: boolean;
  guidedOnly?: boolean;
  jobConfig?: Partial<JobConfig>;
}

export async function runJob(options: RunJobOptions = {}) {
  loadAllowedEnvFile(path.join(rootDir, '.env'), process.env, { warn: true });
  const jobConfig = options.jobConfig ? mergeJobConfig(options.jobConfig) : defaultJobConfig;

  if (!options.skipSkillBuild) {
    await ensureGuidedEvalDist();
  }

  // Create results directory if it doesn't exist
  if (!fs.existsSync(suitesDir)) {
    fs.mkdirSync(suitesDir, { recursive: true });
  }

  const agent = jobConfig.agent;

  // Generate a unique jobId with timestamp or use custom name
  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' }).replace(' ', 'T').replace(/:/g, '-');
  const jobId = options.name || jobConfig.name || `test-${timestamp}`;
  const jobDir = options.outputDir || path.join(suitesDir, jobId);

  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  // Save a snapshot of the merged configuration
  fs.writeFileSync(path.join(jobDir, 'suite_config.json'), JSON.stringify(jobConfig, null, 2));

  // Setup logging to file
  const logFilePath = path.join(jobDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);
  const jobStart = Date.now();

  console.log(`\n=== Evaluation Job Starting with ID: ${jobId} ===`);
  console.log(`Results will be saved to: ${jobDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  try {
    let hasErrors = false;
    const trialsPerCondition = options.numRuns ?? jobConfig.numRuns;
    const endTrialIndex = 1 + trialsPerCondition;

    console.log(`\nStarting execution for ${trialsPerCondition} ${trialsPerCondition === 1 ? 'trial per condition' : 'trials per condition'}`);

    for (let trialIndex = 1; trialIndex < endTrialIndex; trialIndex++) {
      if (agent === Agents.CODEX_CLI) await ensureFreshHostCodexAuth();
      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING REPETITION ${trialIndex} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      const trialIndexDir = path.join(jobDir, String(trialIndex));
      if (!fs.existsSync(trialIndexDir)) {
        fs.mkdirSync(trialIndexDir, { recursive: true });
      }

      const pnpmWorkspacePackages: string[] = [];

      const taskMap = getTaskMap();

      // Use configured tasks, or discover all `task.md` from the guide folders.
      const tasksToRun = options.tasks && options.tasks.length > 0
        ? options.tasks
        : (jobConfig.tasks.length > 0
          ? jobConfig.tasks
          : Array.from(taskMap.keys()));

      const resolvedTasks = tasksToRun.map(resolveTaskName);
      const resolvedTaskSet = new Set(resolvedTasks);
      const variantUnguidedReuses: Array<{
        baseUnguidedDir: string;
        variantUnguidedDir: string;
        graderPath: string;
        guideName: string;
        baselineTarget: string;
      }> = [];

      for (const resolvedTask of resolvedTasks) {
        const taskInfo = taskMap.get(resolvedTask);
        if (!taskInfo) {
          console.warn(`Skipping task ${resolvedTask}: Not found in task map`);
          continue;
        }

        const [guideName, taskName] = resolvedTask.split('/');
        const workspaceBaseAppDir = await setupWorkspaceBaseApp(taskInfo, trialIndexDir, guideName, taskName);
        if (!workspaceBaseAppDir) {
          continue;
        }

        const promptContent = taskInfo.prompt + COMMON_APPEND_PROMPT;
        const agentScript = getAgentScript(agent);

        const conditionsToRun = options.guidedOnly ? ['guided'] : CONDITIONS;
        const guideFolder = path.join(trialIndexDir, guideName);
        const taskFolder = path.join(guideFolder, taskName);
        const graderPath = resolveTaskGraderPath(taskInfo, taskName);
        const baseTaskKey = `${guideName}/${taskInfo.baseApp}`;
        const canReuseBaseUnguided =
          Boolean(taskInfo.baselineTarget) &&
          taskName !== taskInfo.baseApp &&
          resolvedTaskSet.has(baseTaskKey);

        for (const condition of conditionsToRun) {
          const targetDir = path.join(taskFolder, condition);
          if (condition === 'unguided' && canReuseBaseUnguided) {
            variantUnguidedReuses.push({
              baseUnguidedDir: path.join(guideFolder, taskInfo.baseApp, 'unguided'),
              variantUnguidedDir: targetDir,
              graderPath,
              guideName,
              baselineTarget: taskInfo.baselineTarget!,
            });
            continue;
          }
          generateTransientPackage(targetDir, agentScript, promptContent, condition, workspaceBaseAppDir, taskName, guideName, graderPath, taskInfo.baseApp, taskInfo.baselineTarget);
          pnpmWorkspacePackages.push(`${guideName}/${taskName}/${condition}`);
        }
      }

      if (pnpmWorkspacePackages.length > 0) {
        console.log(`\n>>> Running all trials for repetition ${trialIndex} with pnpm -r run-agent ...`);
        // Drop a transient pnpm-workspace.yaml at the root of the trial repetition directory.
        // We explicitly list the packages to avoid executing leftover tasks from prior jobs
        // (e.g. when switching from unguided to --guided).
        const pnpmWorkspacePath = path.join(trialIndexDir, 'pnpm-workspace.yaml');
        const yamlContent = [
          'packages:',
          ...pnpmWorkspacePackages.map(pkg => `  - '${pkg}'`)
        ].join('\n') + '\n';
        fs.writeFileSync(pnpmWorkspacePath, yamlContent);

        try {
          const isAgentOrNonInteractive = Boolean(process.env.CI) || !process.stdout.isTTY || determineAgent().isAgent;
          const pnpmArgs = ['-r', '--no-bail'];
          if (isAgentOrNonInteractive) {
            pnpmArgs.push('--reporter=append-only');
          }
          if (jobConfig.workerCount) {
            pnpmArgs.push('--workspace-concurrency', jobConfig.workerCount.toString());
          }
          pnpmArgs.push('run-agent');
          const jobConfigPath = path.resolve(jobDir, 'suite_config.json');
          await runCommand('pnpm', pnpmArgs, { GD_SUITE_CONFIG: jobConfigPath, ENABLE_FILE_LOGGING: 'true' }, trialIndexDir);
          console.log(`✅ Completed repetition ${trialIndex} executions`);
        } catch (error) {
          console.error(`❌ Failed during repetition ${trialIndex} execution`, error);
          hasErrors = true;
        } finally {
          if (fs.existsSync(pnpmWorkspacePath)) {
            fs.unlinkSync(pnpmWorkspacePath);
          }
          for (const reuse of variantUnguidedReuses) {
            try {
              reuseUnguidedTrialForBaselineVariant(reuse);
            } catch (reuseErr) {
              console.warn(`Failed to reuse unguided trial for ${reuse.variantUnguidedDir}: ${reuseErr}`);
            }
          }
          // Clean up task workspace base_apps after all workers in the trial index finish
          for (const task of tasksToRun) {
            const resolvedTask = resolveTaskName(task);
            const [guideName, taskName] = resolvedTask.split('/');
            const taskBaseAppDir = path.join(trialIndexDir, guideName, taskName, 'base_app');
            if (fs.existsSync(taskBaseAppDir)) {
              try {
                fs.rmSync(taskBaseAppDir, { recursive: true, force: true });
              } catch (err) {
                console.warn(`Failed to clean up ${taskBaseAppDir}: ${err}`);
              }
            }
          }
        }
      }
    }

    if (hasErrors) {
      console.log(`\n❌ Evaluation job completed with errors! Results saved to: ${jobDir} .\n    For details, see agent_stderr.log and/or generation_failed.json`);
    } else {
      console.log(`\n✅ Evaluation job complete! Results saved to: ${jobDir}`);
    }

    if (!options.skipEval) {
      await evaluateJob(jobDir, jobId, jobStart);
    } else {
      const totalRuntime = Date.now() - jobStart;
      console.log(`Total runtime: ${totalRuntime}ms`);
    }

    if (hasErrors) {
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('❌ Error during job execution:', e);
  } finally {
    restoreLogging(originalConsoleMethods);
  }
}

// Hook into console methods to also write to log file
function setupLogging(logFilePath: string) {
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function (...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalLog.apply(console, args);
    if (logStream) {
      logStream.write(`[LOG ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.error = function (...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalError.apply(console, args);
    if (logStream) {
      logStream.write(`[ERROR ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.warn = function (...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalWarn.apply(console, args);
    if (logStream) {
      logStream.write(`[WARN ${new Date().toISOString()}] ${message}\n`);
    }
  };

  return { originalLog, originalError, originalWarn };
}

function restoreLogging(originals: any) {
  if (originals) {
    console.log = originals.originalLog;
    console.error = originals.originalError;
    console.warn = originals.originalWarn;
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

async function runCommand(command: string, args: string[] = [], envOverrides?: Record<string, string>, cwd?: string) {
  const sanitizedEnv = filterAllowedEnv(
    process.env,
    ALLOWED_WRAPPER_ENV_KEYS,
    ALLOWED_ENV_PREFIXES,
    envOverrides,
  );
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd,
      env: sanitizedEnv,
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}


function resolveTaskName(task: string): string {
  // 1. Target task: guides/.../<guideName>/targets/<baseApp>/task.md
  if (task.includes('/targets/')) {
    const [beforeTargets, afterTargets] = task.split('/targets/');
    const guideName = beforeTargets.split('/').pop()!;
    const baseApp = afterTargets.split('/')[0];
    return `${guideName}/${baseApp}`;
  }

  // 2. Legacy task: guides/.../<guideName>/tasks/<taskName>.md
  if (task.includes('/tasks/')) {
    const [beforeTasks, afterTasks] = task.split('/tasks/');
    const guideName = beforeTasks.split('/').pop()!;
    const taskName = afterTasks.replace(/\.md$/, '');
    return `${guideName}/${taskName}`;
  }

  return task;
}

export async function setupWorkspaceBaseApp(taskInfo: TaskInfo, trialIndexDir: string, guideName: string, taskName: string): Promise<string | null> {
  const guideFolder = path.join(trialIndexDir, guideName);
  const taskFolder = path.join(guideFolder, taskName);
  const workspaceBaseAppDir = path.join(taskFolder, 'base_app');
  if (!fs.existsSync(workspaceBaseAppDir)) {
    fs.mkdirSync(workspaceBaseAppDir, { recursive: true });
  }

  const refBaseAppDir = path.join(baseAppsDir, taskInfo.baseApp);
  if (!fs.existsSync(refBaseAppDir)) {
    console.warn(`Source base app not found at ${refBaseAppDir}`);
    return null;
  }
  await copyBaseAppToWorkspace(taskInfo.baseApp, workspaceBaseAppDir);
  const pkgJsonPath = path.join(workspaceBaseAppDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (!pkgJson.pnpm || !pkgJson.pnpm.onlyBuiltDependencies) {
      throw new Error(`Invariant failed: pnpm.onlyBuiltDependencies is missing in ${pkgJsonPath}`);
    }
  }

  // If this is a target-based task and zero-passrate.patch exists, apply it before git init & agent execution
  const targetZeroPassrate = path.join(taskInfo.guideDir, 'targets', taskName, ZERO_PASSRATE_PATCH_FILE);
  const baseAppZeroPassrate = path.join(taskInfo.guideDir, 'targets', taskInfo.baseApp, ZERO_PASSRATE_PATCH_FILE);
  const zeroPassratePath = fs.existsSync(targetZeroPassrate)
    ? targetZeroPassrate
    : (fs.existsSync(baseAppZeroPassrate) ? baseAppZeroPassrate : null);

  if (zeroPassratePath) {
    const applyRes = applyPatchSync(workspaceBaseAppDir, zeroPassratePath);
    if (!applyRes.success) {
      console.warn(`Failed to apply zero-passrate.patch to ${workspaceBaseAppDir}: ${applyRes.error}`);
    } else {
      console.log(`Applied zero-passrate.patch to ${workspaceBaseAppDir}`);
    }
  }

  if (!fs.existsSync(path.join(workspaceBaseAppDir, '.git'))) {
    initGitRepo(workspaceBaseAppDir);
  }

  return workspaceBaseAppDir;
}

export function generateTransientPackage(
  targetDir: string,
  agentScript: string,
  promptContent: string,
  condition: string,
  workspaceBaseAppDir: string,
  taskName: string,
  guideName: string,
  graderPath: string,
  _baseApp: string = 'daily-grind',
  baselineTarget?: string
) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate grade.mjs using shared function
  const gradeScript = getGraderScriptContent(targetDir, graderPath, guideName, baselineTarget);
  fs.writeFileSync(path.join(targetDir, 'grade.mjs'), gradeScript);

  // Generate runner script
  // HACK: To get nice aggregated, prefix-multiplexed output for parallel execution,
  // we trick pnpm into thinking each trial is a package in a pnpm workspace.
  // This way we get `pnpm -r`'s great parallel scheduler and log interleaving for free.
  // This run.mjs wrapper executes the actual agent command via spawnSync.
  const secretGuardModuleUrl = pathToFileURL(path.join(rootDir, 'src/harness/lib/secret-guard.ts')).href;
  const runnerContent = `import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ALLOWED_ENV_PREFIXES,
  ALLOWED_GRADER_ENV_KEYS,
  ALLOWED_WRAPPER_ENV_KEYS,
  filterAllowedEnv,
} from ${JSON.stringify(secretGuardModuleUrl)};

const args = [
...${JSON.stringify([
  agentScript,
  promptContent,
  condition,
  targetDir,
  workspaceBaseAppDir
])}
];

const env = filterAllowedEnv(
  process.env,
  ALLOWED_WRAPPER_ENV_KEYS,
  ALLOWED_ENV_PREFIXES,
  ${baselineTarget ? `{ BASELINE_TARGET: ${JSON.stringify(baselineTarget)} }` : 'undefined'},
);

const start = Date.now();
let result;
let attempts = 0;
const maxAttempts = 2; // 1 initial attempt + 1 retry with exponential backoff
const baseDelay = 15000; // 15 seconds base delay
const targetDirPath = ${JSON.stringify(targetDir)};
const failureFile = path.join(targetDirPath, 'generation_failed.json');
const initialEntries = new Set(fs.readdirSync(targetDirPath).filter(e => e !== 'generation_failed.json'));

while (attempts < maxAttempts) {
  attempts++;
  for (const entry of fs.readdirSync(targetDirPath)) {
    if (!initialEntries.has(entry)) {
      fs.rmSync(path.join(targetDirPath, entry), { recursive: true, force: true });
    }
  }
  // Assign the isolated HOME here so it is removed even if the timeout kills the agent
  // wrapper before its own cleanup runs.
  const isolatedHome = '/tmp/ghh-' + ${JSON.stringify(path.basename(agentScript).replace(/-agent\.ts$/, ''))} + '-' + randomUUID().slice(0, 8);
  result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ${JSON.stringify(process.cwd())}, timeout: 900000, env: { ...env, ${ISOLATED_HOME_ENV}: isolatedHome } });
  try {
    fs.rmSync(isolatedHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (cleanupErr) {
    console.warn('Failed to cleanup isolated HOME ' + isolatedHome + ':', cleanupErr);
  }
  if (result.status === 0) break;

  // Check if this is a rate limit error (429)
  const isRateLimit = result.error?.code !== 'ETIMEDOUT' && (result.status === 1 || (result.stderr && result.stderr.toString().includes('429')));

  if (attempts < maxAttempts) {
    // Exponential backoff: 15s, 30s (with some jitter)
    // For rate limits, use longer delays
    const base = isRateLimit ? 30000 : baseDelay;
    const delay = base * Math.pow(2, attempts - 1) + Math.random() * 5000;
    const delaySec = Math.round(delay / 1000);

    if (isRateLimit) {
      console.warn('⚠️ Rate limit hit (429). Attempt ' + attempts + ' failed. Waiting ' + delaySec + 's before retry...');
    } else {
      console.warn('⚠️ Attempt ' + attempts + ' failed with status ' + result.status + '. Waiting ' + delaySec + 's (exponential backoff)...');
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, ' + delay + ')']);
  }
}
const runtime = Date.now() - start;

let graderRuntime = null;
let graderStatus = null;

if (result.status === 0) {
  const gradeStart = Date.now();
  const gradeEnv = filterAllowedEnv(
    process.env,
    ALLOWED_GRADER_ENV_KEYS,
    ALLOWED_ENV_PREFIXES,
    { PATCH_FILE: path.join(${JSON.stringify(targetDir)}, 'agent.patch') },
  );
  const gradeResult = spawnSync(process.execPath, ['grade.mjs'], { stdio: 'inherit', cwd: ${JSON.stringify(targetDir)}, env: gradeEnv });
  graderRuntime = Date.now() - gradeStart;
  graderStatus = gradeResult.status ?? 1;
} else if (!fs.existsSync(failureFile)) {
  const timedOut = result.error?.code === 'ETIMEDOUT';
  fs.writeFileSync(failureFile, JSON.stringify({
    agentName: path.basename(${JSON.stringify(agentScript)}),
    exitCode: timedOut ? 'TIMEOUT (15m)' : result.status,
    stderr: timedOut
      ? 'Agent timed out after 15 minutes'
      : 'Agent execution failed unexpectedly during setup or wrapper invocation',
    stdout: ''
  }, null, 2));
}

fs.writeFileSync(path.join(${JSON.stringify(targetDir)}, 'runtime.json'), JSON.stringify({
  agentRuntime: runtime,
  graderRuntime: graderRuntime,
  agentStatus: result.status,
  graderStatus: graderStatus
}, null, 2));

process.exit(graderStatus !== null ? graderStatus : (result.status ?? 1));
`.trim();

  fs.writeFileSync(path.join(targetDir, 'run.mjs'), runnerContent);

  // Generate transient package.json
  // This tells pnpm that this directory is a "package" that can be run
  // via `pnpm run-agent`.
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
    name: `${taskName.substring(0, 30)}-${condition}`,
    type: "module",
    scripts: { "run-agent": "node run.mjs" }
  }, null, 2));
}

function reuseUnguidedTrialForBaselineVariant(opts: {
  baseUnguidedDir: string;
  variantUnguidedDir: string;
  graderPath: string;
  guideName: string;
  baselineTarget: string;
}) {
  const { baseUnguidedDir, variantUnguidedDir, graderPath, guideName, baselineTarget } = opts;
  if (!fs.existsSync(baseUnguidedDir)) return;
  fs.rmSync(variantUnguidedDir, { recursive: true, force: true });
  fs.mkdirSync(variantUnguidedDir, { recursive: true });

  const resultsFileName = `${guideName}_results.json`;
  for (const entry of fs.readdirSync(baseUnguidedDir)) {
    if (
      entry === 'grade.mjs' ||
      entry === 'run.mjs' ||
      entry === 'package.json' ||
      entry === 'playwright-report.json' ||
      entry === resultsFileName
    ) {
      continue;
    }
    fs.cpSync(path.join(baseUnguidedDir, entry), path.join(variantUnguidedDir, entry), { recursive: true });
  }

  const gradeScript = getGraderScriptContent(variantUnguidedDir, graderPath, guideName, baselineTarget);
  fs.writeFileSync(path.join(variantUnguidedDir, 'grade.mjs'), gradeScript);

  if (!fs.existsSync(path.join(variantUnguidedDir, 'generation_failed.json'))) {
    const gradeStart = Date.now();
    const gradeEnv = filterAllowedEnv(process.env, ALLOWED_GRADER_ENV_KEYS, ALLOWED_ENV_PREFIXES, {
      PATCH_FILE: path.join(variantUnguidedDir, 'agent.patch'),
    });
    const gradeResult = spawnSync(process.execPath, ['grade.mjs'], {
      stdio: 'inherit',
      cwd: variantUnguidedDir,
      env: gradeEnv,
    });
    const runtimePath = path.join(variantUnguidedDir, 'runtime.json');
    if (fs.existsSync(runtimePath)) {
      try {
        const runtimeObj = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
        runtimeObj.graderRuntime = Date.now() - gradeStart;
        runtimeObj.graderStatus = gradeResult.status ?? 1;
        fs.writeFileSync(runtimePath, JSON.stringify(runtimeObj, null, 2));
      } catch {
        // Ignore runtime.json update error
      }
    }
  }
}

const AGENT_SCRIPTS: Record<string, string> = {
  [Agents.CLAUDE_CODE]: 'claude-code-agent.ts',
  [Agents.CODEX_CLI]: 'codex-cli-agent.ts',
  [Agents.JETSKI_CLI]: 'jetski-cli-agent.ts',
  [Agents.PI]: 'pi-agent.ts',
  [Agents.ANTIGRAVITY_CLI]: 'antigravity-cli-agent.ts',
};

function getAgentScript(agent: string): string {
  const script = AGENT_SCRIPTS[agent];
  if (!script) {
    throw new Error(`Unsupported agent: ${agent}. Expected one of: ${Object.keys(AGENT_SCRIPTS).join(', ')}`);
  }
  return path.join(import.meta.dirname, 'agents', script);
}

// If invoked directly, retain legacy fallback logic if strictly required (optional).
// But for native gd.ts import, the exports are used.
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  if (positionalArgs.length >= 1) {
    runJob({ tasks: positionalArgs }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    runJob().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
