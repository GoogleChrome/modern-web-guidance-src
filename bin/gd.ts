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
const completion = omelette('gd <workflow> <action> <item>');

completion.on('workflow', ({ reply }) => {
  reply(['eval', 'guide', 'setup-completion']);
});

completion.on('action', ({ before, reply }) => {
  if (before === 'eval') {
    reply(['suite', 'task', 'smoke', 'agent', 'report', 'dashboard']);
  } else if (before === 'guide') {
    reply(['grade', 'test-grader', 'gen-grader', 'gen-negative']);
  }
});

completion.on('item', ({ before, line, reply }) => {
  if (!line.includes('eval') && !line.includes('guide')) return;

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
  const workflow = positionals[0];

  if (values.help || !workflow) {
    console.log(`
Guidance CLI (gd) - Unified interface for operations

Usage: gd <workflow> <action> [options]

Workflows:
  eval     System Evaluators: Test the whole system and run evaluations
  guide    Guidance Contributors: Create, test, and calibrate guidance files

Eval Commands (gd eval <action>):
  suite          Run the full evaluation suite
  task [id]      Run a specific task
  smoke          Run the quick smoke test
  agent [tmpl]   Run an agent against a template
  report         Generate an evaluation report
  dashboard      Start the evaluation dashboard

Guide Commands (gd guide <action>):
  grade [file]       Run the grader on a specific demo or negative-demo file
  test-grader [dir]  Check grader calibration against demo and negative-demo
  gen-grader [dir]   Generate a new grader script
  gen-negative [dir] Generate negative examples

Other Commands:
  setup-completion   Install shell auto-completion for Fish, Bash, and Zsh

Options:
  -h, --help     Show this help
  -v, --version  Show version number
    `);
    process.exit(0);
  }

  const passThroughArgs = process.argv.slice(4); // Grab raw args after `gd <workflow> <action>`
  let inProcess = false;

  if (workflow === 'setup-completion') {
    completion.setupShellInitFile();
    console.log('Auto-completion successfully installed into your shell profile.');
    console.log('Please restart your terminal or run your shell configuration file again to apply.');
    process.exit(0);
  }

  const action = positionals[1];
  if (!action) {
    console.error(`Missing action for workflow '${workflow}'. Run 'gd --help' for usage.`);
    process.exit(1);
  }

  if (workflow === 'eval') {
    switch (action) {
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
      case 'report':
        const { evaluate } = await import('../harness/evaluate.ts');
        await evaluate();
        inProcess = true;
        break;
      case 'dashboard':
        process.chdir(path.join(rootDir, 'eval-view'));
        process.argv = [process.argv[0], process.argv[1], ...passThroughArgs];
        await import('../eval-view/server.js');
        inProcess = true;
        break;
      default:
        console.error(`Unknown 'eval' command: ${action}. Run 'gd --help' for usage.`);
        process.exit(1);
    }
  } else if (workflow === 'guide') {
    switch (action) {
      case 'grade':
        const { runGrader } = await import('../guides/run-grader.ts');
        await runGrader(passThroughArgs[0]);
        inProcess = true;
        break;
      case 'test-grader':
        const { testGrader } = await import('../guides/test-grader.ts');
        await testGrader(passThroughArgs[0] || process.cwd());
        inProcess = true;
        break;
      case 'gen-grader':
        const { generateGrader } = await import('../guides/grader-gen.ts');
        await generateGrader(passThroughArgs[0]);
        inProcess = true;
        break;
      case 'gen-negative':
        const { generateNegative } = await import('../guides/negative-gen.ts');
        await generateNegative(passThroughArgs[0]);
        inProcess = true;
        break;
      default:
        console.error(`Unknown 'guide' command: ${action}. Run 'gd --help' for usage.`);
        process.exit(1);
    }
  } else {
    // Legacy fallback help map
    if (['suite', 'task', 'smoke', 'agent', 'report', 'dashboard'].includes(workflow)) {
      console.error(`\x1b[31mError:\x1b[0m Command '${workflow}' has been moved to the 'eval' namespace.\n  Please run: \x1b[36mgd eval ${workflow}\x1b[0m\n`);
    } else if (['grade', 'test-grader', 'gen:grader', 'gen:negative'].includes(workflow)) {
      const mapped = workflow.replace('gen:', 'gen-');
      console.error(`\x1b[31mError:\x1b[0m Command '${workflow}' has been moved to the 'guide' namespace.\n  Please run: \x1b[36mgd guide ${mapped}\x1b[0m\n`);
    } else {
      console.error(`Unknown workflow: ${workflow}. Run 'gd --help' for usage.`);
    }
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
