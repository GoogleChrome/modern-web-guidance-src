import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Agents, defaultSuiteConfig, mergeSuiteConfig, type SuiteConfig } from './config.ts';
import { evaluateSuite } from './evaluate.ts';
import { harnessDir, baseAppsDir, resultsDir } from '../lib/paths.ts';
import { getTaskMap, type TaskInfo } from '../lib/guide-validation.ts';
import { getGraderScriptContent } from './lib/agent-shared.ts';

const RUN_TYPES = ['guided', 'unguided'];

// Global log file stream
let logStream: fs.WriteStream | null = null;


const COMMON_APPEND_PROMPT = `\n\nDon't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

export async function runAgent(templateDirRaw: string, promptContentRaw: string, providedSuiteConfig?: SuiteConfig) {
  const suiteConfig = providedSuiteConfig || defaultSuiteConfig;
  const agent = suiteConfig.agent;
  let templateDir = templateDirRaw;
  if (!path.isAbsolute(templateDir)) {
    templateDir = path.resolve(process.cwd(), templateDir);
  }
  const cleanTemplateDir = templateDir.replace(/\/$/, '');
  const targetDir = path.join(path.dirname(cleanTemplateDir), path.basename(cleanTemplateDir) + '-results');
  const taskNameLabel = "Agent Test";
  const promptContent = promptContentRaw + COMMON_APPEND_PROMPT;

  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`);
    return;
  }

  console.log(`\n=== Running ${taskNameLabel} ===`);
  console.log(`Agent: ${agent}`);
  console.log(`Template: ${templateDir}`);
  console.log(`Target: ${targetDir}\n`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Save a snapshot of the current global configuration (which may have been merged with overrides)
  fs.writeFileSync(path.join(targetDir, 'suite_config.json'), JSON.stringify(suiteConfig, null, 2));

  try {
    const agentScript = path.join(harnessDir, 'agents',
      agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
        agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
          agent === Agents.CODEX_CLI ? 'codex-cli-agent.ts' :
            agent === Agents.JETSKI_CLI ? 'jetski-cli-agent.ts' :
              'jetski-agent.ts'
    );

    const suiteConfigPath = path.resolve(targetDir, 'suite_config.json');
    await runCommand('node', [
      '--experimental-strip-types',
      agentScript,
      JSON.stringify(promptContent),
      'guided', // Default to guided for ad-hoc tool execution
      targetDir,
      templateDir
    ], { GD_SUITE_CONFIG: suiteConfigPath, ENABLE_FILE_LOGGING: 'true' });
    console.log(`\n✅ ${taskNameLabel} complete! Results in ${targetDir}`);
  } catch (error) {
    console.error(`❌ ${taskNameLabel} failed:`, error);
  }
}

export interface RunSuiteOptions {
  name?: string;
  outputDir?: string;
  tasks?: string[];
  numRuns?: number;
  skipEval?: boolean;
  guidedOnly?: boolean;
  suiteConfig?: SuiteConfig;
}

export async function runSuite(options: RunSuiteOptions = {}) {
  const suiteConfig = options.suiteConfig ? mergeSuiteConfig(options.suiteConfig) : defaultSuiteConfig;

  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const agent = suiteConfig.agent;

  // Generate a unique testID with timestamp or use custom name
  const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' }).replace(' ', 'T').replace(/:/g, '-');
  const testID = options.name || suiteConfig.name || `test-${timestamp}`;
  const testDir = options.outputDir || path.join(resultsDir, testID);

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Save a snapshot of the merged configuration
  fs.writeFileSync(path.join(testDir, 'suite_config.json'), JSON.stringify(suiteConfig, null, 2));

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);
  const suiteStart = Date.now();

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  try {
    let hasErrors = false;
    const numRuns = options.numRuns ?? suiteConfig.numRuns;
    const endRun = 1 + numRuns;

    console.log(`\nStarting execution for ${numRuns} runs`);

    for (let runNumber = 1; runNumber < endRun; runNumber++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING RUN ${runNumber} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      const runDir = path.join(testDir, String(runNumber));
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      const pnpmWorkspacePackages: string[] = [];

      const taskMap = getTaskMap();

      // Use configured tasks, or discover all `task.md` from the guide folders.
      const tasksToRun = options.tasks && options.tasks.length > 0
        ? options.tasks
        : (suiteConfig.tasks.length > 0
          ? suiteConfig.tasks
          : Array.from(taskMap.keys()).filter(key => key.endsWith('/task')));

      for (const task of tasksToRun) {
        const resolvedTask = resolveTaskName(task);
        const taskInfo = taskMap.get(resolvedTask);
        if (!taskInfo) {
          console.warn(`Skipping task ${task}: Not found in task map`);
          continue;
        }

        const [guideName, taskName] = resolvedTask.split('/');
        const workspaceBaseAppDir = await setupWorkspaceBaseApp(taskInfo, runDir, guideName, taskName);
        if (!workspaceBaseAppDir) {
          continue;
        }

        let promptContent = taskInfo.prompt;
        promptContent += COMMON_APPEND_PROMPT;
        const agentScript = getAgentScript(agent);

        const runTypesToRun = options.guidedOnly ? ['guided'] : RUN_TYPES;
        const guideFolder = path.join(runDir, guideName);
        const taskFolder = path.join(guideFolder, taskName);
        const graderPath = path.join(taskInfo.guideDir, 'grader.ts');

        for (const runType of runTypesToRun) {
          const targetDir = path.join(taskFolder, runType);
          generateTransientPackage(targetDir, agentScript, promptContent, runType, workspaceBaseAppDir, taskName, guideName, graderPath);
          pnpmWorkspacePackages.push(`${guideName}/${taskName}/${runType}`);
        }
      }

      if (pnpmWorkspacePackages.length > 0) {
        console.log(`\n>>> Running all tests for Run ${runNumber} with pnpm -r run-agent ...`);
        // Drop a transient pnpm-workspace.yaml at the root of the run directory.
        // We explicitly list the packages to avoid running leftover tasks from previous runs
        // (e.g. when switching from unguided to --guided).
        const pnpmWorkspacePath = path.join(runDir, 'pnpm-workspace.yaml');
        const yamlContent = [
          'packages:',
          ...pnpmWorkspacePackages.map(pkg => `  - '${pkg}'`)
        ].join('\n') + '\n';
        fs.writeFileSync(pnpmWorkspacePath, yamlContent);

        try {
          const pnpmArgs = ['-r', '--no-bail'];
          if (agent === Agents.JETSKI) {
            pnpmArgs.push('--workspace-concurrency', '1');
          } else if (suiteConfig.workerCount) {
            pnpmArgs.push('--workspace-concurrency', suiteConfig.workerCount.toString());
          }
          pnpmArgs.push('run-agent');
          const suiteConfigPath = path.resolve(testDir, 'suite_config.json');
          await runCommand('pnpm', pnpmArgs, { GD_SUITE_CONFIG: suiteConfigPath, ENABLE_FILE_LOGGING: 'true' }, runDir);
          console.log(`✅ Completed Run ${runNumber} test executions`);
        } catch (error) {
          console.error(`❌ Failed during Run ${runNumber} test execution`, error);
          hasErrors = true;
        } finally {
          if (fs.existsSync(pnpmWorkspacePath)) {
            fs.unlinkSync(pnpmWorkspacePath);
          }
        }
      }
    }

    if (hasErrors) {
      console.log(`\n❌ Test suite completed with errors! Results saved to: ${testDir} .\n    For details, see agent_stderr.log and/or generation_failed.json`);
    } else {
      console.log(`\n✅ Test suite complete! Results saved to: ${testDir}`);
    }

    if (!options.skipEval) {
      await evaluateSuite(testDir, testID, suiteStart);
    } else {
      const totalRuntime = Date.now() - suiteStart;
      console.log(`Total runtime: ${totalRuntime}ms`);
    }

    if (hasErrors) {
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('❌ Error during suite execution:', e);
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
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd,
      env: envOverrides ? { ...process.env, ...envOverrides } : process.env
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
  let resolvedTask = task;
  if (task.startsWith('guides/')) {
    const segments = task.split('/');
    if (segments.length === 4 && segments[2] === 'tasks') {
      // Support discipline skill tasks (e.g., guides/forms/tasks/task.md)
      const guideName = segments[1];
      const taskName = segments[3].replace('.md', '');
      resolvedTask = `${guideName}/${taskName}`;
    } else if (segments.length >= 3) {
      // Standard guide path: guides/category/guideName/...
      const guideName = segments[2];
      let taskName = 'task';
      const lastSegment = segments[segments.length - 1];
      if (lastSegment.endsWith('.md')) {
        taskName = lastSegment.replace('.md', '');
      }
      resolvedTask = `${guideName}/${taskName}`;
    }
  } else if (!task.includes('/')) {
    resolvedTask = `${task}/task`;
  }
  return resolvedTask;
}

async function setupWorkspaceBaseApp(taskInfo: TaskInfo, runDir: string, guideName: string, taskName: string): Promise<string | null> {
  // Copy the base app to the run directory (for tracking purposes)
  const guideFolder = path.join(runDir, guideName);
  const taskFolder = path.join(guideFolder, taskName);
  const workspaceBaseAppDir = path.join(taskFolder, 'base_app');
  if (!fs.existsSync(workspaceBaseAppDir)) {
    fs.mkdirSync(workspaceBaseAppDir, { recursive: true });
  }

  if (taskName === 'negative') {
    const negativeDemoPath = path.join(taskInfo.guideDir, 'negative-demo.html');
    if (fs.existsSync(negativeDemoPath)) {
      fs.copyFileSync(negativeDemoPath, path.join(workspaceBaseAppDir, 'index.html'));
    } else {
      console.warn(`Skipping negative run for ${guideName}/${taskName}: Missing negative-demo.html`);
      return null;
    }
  } else {
    const sourceBaseAppDir = path.join(baseAppsDir, taskInfo.baseApp);
    if (fs.existsSync(sourceBaseAppDir)) {
      await fs.promises.cp(sourceBaseAppDir, workspaceBaseAppDir, {
        recursive: true,
        filter: (src) => {
          const basename = path.basename(src);
          return !['node_modules', '.git', 'dist', '.astro'].includes(basename);
        }
      });

      const pkgJsonPath = path.join(workspaceBaseAppDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (!pkgJson.pnpm || !pkgJson.pnpm.onlyBuiltDependencies) {
          throw new Error(`Assertion failed: pnpm.onlyBuiltDependencies is missing in ${pkgJsonPath}`);
        }

        // pnpm install is intentionally deferred until after agent execution
        // to avoid copying massive node_modules directories.
      }
    }
  }

  return workspaceBaseAppDir;
}

function generateTransientPackage(
  targetDir: string,
  agentScript: string,
  promptContent: string,
  runType: string,
  workspaceBaseAppDir: string,
  taskName: string,
  guideName: string,
  graderPath: string
) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate grade.mjs using shared function
  const gradeScript = getGraderScriptContent(targetDir, graderPath, guideName);
  fs.writeFileSync(path.join(targetDir, 'grade.mjs'), gradeScript);

  // Create npx wrapper to intercept modern-web-guidance calls during evals
  const rootDir = path.resolve(harnessDir, '..');
  const templatePath = path.join(harnessDir, 'npx-intercept.template.ts');
  const localCliPath = path.join(rootDir, 'dist', 'skills-cli', 'skills/modern-web-guidance/modern-web.mjs');

  if (fs.existsSync(templatePath)) {
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    templateContent = templateContent.replace('__LOCAL_CLI_PATH__', localCliPath);

    const npxWrapperPath = path.join(targetDir, 'npx');
    fs.writeFileSync(npxWrapperPath, templateContent);
    fs.chmodSync(npxWrapperPath, 0o755); // Make executable
  } else {
    console.warn(`Warning: npx-intercept.template.ts not found at ${templatePath}`);
  }

  // Generate runner script
  // HACK: To get nice aggregated, prefix-multiplexed output for parallel runs,
  // we trick pnpm into thinking each test run is a package in a pnpm workspace.
  // This way we get `pnpm -r`'s great parallel scheduler and log interleaving for free.
  // This run.mjs wrapper executes the actual agent command via spawnSync.
  const runnerContent = `import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = [
'--experimental-strip-types',
...${JSON.stringify([
  agentScript,
  promptContent,
  runType,
  targetDir,
  workspaceBaseAppDir
])}
];

// Intercept npx by prepending targetDir to PATH
const env = { ...process.env };
env.PATH = \`${targetDir}:\${env.PATH}\`;

const start = Date.now();
const result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ${JSON.stringify(process.cwd())}, timeout: 600000, env });
const runtime = Date.now() - start;

let graderRuntime = null;
let graderStatus = null;

if (result.status === 0) {
  const gradeStart = Date.now();
  const gradeResult = spawnSync(process.execPath, ['--experimental-strip-types', 'grade.mjs'], { stdio: 'inherit', cwd: ${JSON.stringify(targetDir)} });
  graderRuntime = Date.now() - gradeStart;
  graderStatus = gradeResult.status;
}

fs.writeFileSync(path.join(${JSON.stringify(targetDir)}, 'runtime.json'), JSON.stringify({
  agentRuntime: runtime,
  graderRuntime: graderRuntime,
  agentStatus: result.status,
  graderStatus: graderStatus
}, null, 2));

process.exit(graderStatus !== null ? graderStatus : result.status ?? 0);
`.trim();

  fs.writeFileSync(path.join(targetDir, 'run.mjs'), runnerContent);

  // Generate transient package.json
  // This tells pnpm that this directory is a "package" that can be run
  // via \`pnpm run-agent\`.
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
    name: `${taskName.substring(0, 30)}-${runType}`,
    type: "module",
    scripts: { "run-agent": "node run.mjs" }
  }, null, 2));
}

function getAgentScript(agent: string): string {
  return path.join(harnessDir, 'agents', agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
    agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
    agent === Agents.CODEX_CLI ? 'codex-cli-agent.ts' :
    agent === Agents.JETSKI_CLI ? 'jetski-cli-agent.ts' :
      'jetski-agent.ts');
}

// If invoked directly, retain legacy fallback logic if strictly required (optional).
// But for native gd.ts import, the exports are used.
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  if (positionalArgs.length >= 1) {
    runSuite({ tasks: positionalArgs }).catch(console.error);
  } else {
    runSuite().catch(console.error);
  }
}
