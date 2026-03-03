#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import omelette from 'omelette';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables strictly without external dependencies (Node 20.12+)
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch (e) {
  // Ignore if file doesn't exist
}

// 1. Setup Shell Auto-Completion (Native Bash/Zsh/Fish support)
const completion = omelette('gd <action> <item>');
completion.on('action', ({ reply }) => {
  reply([
    'suite', 'task', 'smoke', 'agent', 
    'report', 'grade', 'dashboard', 
    'gen:grader', 'gen:negative',
    'setup-completion'
  ]);
});

completion.on('item', ({ before, reply }) => {
  if (before === 'task') {
    const tasksDir = path.join(rootDir, 'harness', 'tasks');
    if (fs.existsSync(tasksDir)) {
      const tasks = fs.readdirSync(tasksDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
      reply(tasks);
    }
  } else if (before === 'agent') {
    const baseAppsDir = path.join(rootDir, 'harness', 'base_apps');
    if (fs.existsSync(baseAppsDir)) {
      const apps = fs.readdirSync(baseAppsDir)
        .filter(dir => fs.statSync(path.join(baseAppsDir, dir)).isDirectory());
      reply(apps);
    }
  }
});

completion.init();

// 2. Setup argument parsing logic using Node's zero-dependency `util.parseArgs`
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  allowPositionals: true,
  strict: false // allow pass-through args for the underlying scripts
});

// Helper functions for spawning children
function spawnChild(command: string, args: string[], options: import('child_process').SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      stdio: 'inherit',
      cwd: rootDir,
      ...options,
    });
    p.on('close', (code) => resolve(code ?? 0));
    p.on('error', (err) => reject(err));
  });
}

function runNpm(args: string[]) {
  return spawnChild('pnpm', args);
}

function runNode(args: string[]) {
  return spawnChild('node', args);
}

// 3. Command Routing
async function main() {
  const action = positionals[0];

  if (!action || values.help) {
    console.log(`
gd <cmd> [args]

Commands:
  suite          Run the evaluation suite
  task [id]      Run a specific task
  smoke          Run the quick smoke test
  agent          Run the evaluation suite with an agent template
  report         Generate an evaluation report
  grade          Run the grader
  dashboard      Start the evaluation dashboard
  gen:grader     Generate a new grader
  gen:negative   Generate negative examples

  setup-completion  Install shell auto-completion for Fish, Bash, and Zsh

Options:
  -h, --help     Show this help
  -v, --version  Show version number
    `);
    process.exit(0);
  }

  const passThroughArgs = process.argv.slice(3); // Grab raw args to pass through everything

  let inProcess = false;

  switch (action) {
    // Execution Commands
    case 'suite':
      const buildCode = await runNpm(['build:mcp']);
      if (buildCode !== 0) process.exit(buildCode);
      const { runSuite } = await import('../harness/run_suite.ts');
      await runSuite();
      inProcess = true;
      break;
    case 'task':
      const { runSingleTask } = await import('../harness/run_suite.ts');
      await runSingleTask(passThroughArgs[0]);
      inProcess = true;
      break;
    case 'smoke':
      const { runSmokeTest } = await import('../harness/quick-smoke.ts');
      await runSmokeTest();
      inProcess = true;
      break;
    case 'agent':
      const { runAgent } = await import('../harness/run_suite.ts');
      await runAgent(passThroughArgs[0], passThroughArgs[1]);
      inProcess = true;
      break;
      
    // Evaluation & Reporting
    case 'report':
      const { evaluate } = await import('../harness/evaluate.ts');
      await evaluate();
      inProcess = true;
      break;
    case 'grade':
      const { runGrader } = await import('../guides/run-grader.ts');
      await runGrader(passThroughArgs[0]);
      inProcess = true;
      break;

    // Tooling & Dashboard
    case 'dashboard':
      // The dashboard server relies heavily on its relative directory (eval-view).
      // Chdir to it before importing so it runs identically as it did via 'pnpm start'.
      process.chdir(path.join(rootDir, 'eval-view'));
      process.argv = [process.argv[0], process.argv[1], ...passThroughArgs];
      await import('../eval-view/server.js');
      inProcess = true;
      break;
    case 'gen:grader':
      const { generateGrader } = await import('../guides/grader-gen.ts');
      await generateGrader(passThroughArgs[0]);
      inProcess = true;
      break;
    case 'gen:negative':
      const { generateNegative } = await import('../guides/negative-gen.ts');
      await generateNegative(passThroughArgs[0]);
      inProcess = true;
      break;

    case 'setup-completion':
      completion.setupShellInitFile();
      console.log('Auto-completion successfully installed into your shell profile.');
      console.log('Please restart your terminal or run your shell configuration file again to apply.');
      break;

    default:
      console.error(`Unknown command: ${action}. Run 'gd --help' for usage.`);
      process.exit(1);
  }

  // If we handed off execution to an imported script, do not forcefully exit.
  // We allow the Node.js event loop to naturally wind down.
  if (!inProcess) {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
