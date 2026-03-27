import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { config, Agents } from './config.ts';
import matter from 'gray-matter';
import { evaluateSuite } from './evaluate.ts';
import { rootDir } from '../lib/root.ts';

const RUN_TYPES = ['guided', 'unguided'];

// Global log file stream
let logStream: fs.WriteStream | null = null;

const baseDir = path.join(rootDir, 'harness');
const baseAppsDir = path.join(baseDir, 'base_apps');
const tasksDir = path.join(baseDir, 'tasks');
const resultsDir = path.join(baseDir, 'results');

const COMMON_APPEND_PROMPT = `\n\nDon't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

export async function runAgent(templateDirRaw: string, promptContentRaw: string) {
  const agent = config.suite.agent;
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

  try {
    const agentScript = path.join(baseDir, 'agents',
      agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
        agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
          agent === Agents.CODEX_CLI ? 'codex-cli-agent.ts' :
            'jetski-agent.ts'
    );

    await runCommand('node', [
      '--experimental-strip-types', 
      agentScript, 
      JSON.stringify(promptContent), 
      'guided', // Default to guided for ad-hoc tool execution
      targetDir,
      templateDir
    ]);
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
}

export async function runSuite(options: RunSuiteOptions = {}) {
  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const agent = config.suite.agent;

  // Generate a unique testID with timestamp or use custom name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const testID = options.name || config.suite.name || `test_${timestamp}`;
  const testDir = options.outputDir || path.join(resultsDir, testID);
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  try {
    let hasErrors = false;
    const numRuns = options.numRuns || config.suite.numRuns;
    const endRun = 1 + numRuns;
      const isNegativeSuite = config.suite.negative === true;
      const currentTasksDir = isNegativeSuite ? path.join(tasksDir, 'negative') : tasksDir;

      console.log(`\nStarting execution for ${numRuns} runs ${isNegativeSuite ? '(Negative Suite)' : ''}`);

      for (let runNumber = 1; runNumber < endRun; runNumber++) {

        console.log(`\n${'='.repeat(60)}`);
        console.log(`>>> STARTING RUN ${runNumber} <<<`);
        console.log(`${'='.repeat(60)}\n`);

        const runDir = path.join(testDir, String(runNumber));
        if (!fs.existsSync(runDir)) {
          fs.mkdirSync(runDir, { recursive: true });
        }

        const pnpmWorkspacePackages: string[] = [];

        // Use configured tasks, or discover all tasks in the tasks directory
        const tasksToRun = options.tasks && options.tasks.length > 0
          ? options.tasks
          : (config.suite.tasks.length > 0
            ? config.suite.tasks
            : fs.readdirSync(currentTasksDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')));

        for (const task of tasksToRun) {
          // Read prompt from task
          const taskPath = path.join(currentTasksDir, `${task}.md`);
        if (!fs.existsSync(taskPath)) {
          console.warn(`Skipping task ${task}: ${taskPath} not found`);
          continue;
        }

        const fileContent = fs.readFileSync(taskPath, 'utf8');
        const { data, content } = matter(fileContent);
        
        if (!data || Object.keys(data).length === 0) {
          console.warn(`Skipping task ${task}: Invalid frontmatter format in ${taskPath}`);
          continue;
        }

        if (!data.base_app) {
          console.warn(`Skipping task ${task}: Missing base_app in frontmatter in ${taskPath}`);
          continue;
        }

        const baseApp = data.base_app.trim();
        let promptContent = content.trim();

        promptContent += COMMON_APPEND_PROMPT;

        const runTypesToRun = options.guidedOnly ? ['guided'] : RUN_TYPES;
        for (const runType of runTypesToRun) {
          const templateDir = path.join(baseAppsDir, baseApp);

          if (!fs.existsSync(templateDir)) {
            throw new Error(`Template directory not found: ${templateDir}`);
          }

          const targetDir = path.join(runDir, task, runType);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const agentScript = path.join(baseDir, 'agents', agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
            agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
            agent === Agents.CODEX_CLI ? 'codex-cli-agent.ts' :
              'jetski-agent.ts');

          // Generate runner script
          // HACK: To get nice aggregated, prefix-multiplexed output for parallel runs,
          // we trick pnpm into thinking each test run is a package in a pnpm workspace.
          // This way we get \`pnpm -r\`'s great parallel scheduler and log interleaving for free.
// This run.mjs wrapper executes the actual agent command via spawnSync.
          const runnerContent = `
import { spawnSync } from 'child_process';
const args = [
  '--experimental-strip-types',
  ...${JSON.stringify([
    agentScript,
    promptContent,
    runType,
    targetDir,
    templateDir
  ])}
];
const result = spawnSync('node', args, { stdio: 'inherit', cwd: ${JSON.stringify(process.cwd())} });
process.exit(result.status ?? 0);
          `.trim();
          
          fs.writeFileSync(path.join(targetDir, 'run.mjs'), runnerContent);

          // Generate transient package.json
          // This tells pnpm that this directory is a "package" that can be run
          // via \`pnpm run-agent\`.
          fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
            name: `${task.substring(0, 30)}-${runType}`,
            type: "module",
            scripts: { "run-agent": "node run.mjs" }
          }, null, 2));

          pnpmWorkspacePackages.push(`${task}/${runType}`);
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
          const pnpmArgs = ['-r'];
          if (agent === Agents.JETSKI) {
            pnpmArgs.push('--workspace-concurrency', '1');
          }
          pnpmArgs.push('run-agent');
          await runCommand('pnpm', pnpmArgs, runDir);
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
      console.log(`\n❌ Test suite completed with errors! Results saved to: ${testDir}`);
    } else {
      console.log(`\n✅ Test suite complete! Results saved to: ${testDir}`);
    }

    if (!options.skipEval) {
      await evaluateSuite(testDir, testID);
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

async function runCommand(command: string, args: string[] = [], cwd?: string) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// If invoked directly, retain legacy fallback logic if strictly required (optional).
// But for native gd.ts import, the exports are used.
if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  if (positionalArgs.length === 2 && args.includes('--with-template')) {
    runAgent(positionalArgs[0], positionalArgs[1]).catch(console.error);
  } else if (positionalArgs.length >= 1) {
    runSuite({ tasks: positionalArgs }).catch(console.error);
  } else {
    runSuite().catch(console.error);
  }
}
