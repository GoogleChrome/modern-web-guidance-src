#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import omelette from 'omelette';
import { fileURLToPath } from 'url';
import { cRed, cCyan } from '../lib/colors.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables (Node 20.12+)
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch (e) {
  // Ignore if file doesn't exist
}

// --- Shell Auto-Completion ---

function listGuideDirs(): string[] {
  const guidesDir = path.join(rootDir, 'guides');
  const categories = ['performance', 'user-experience', 'accessibility', 'security'];
  const dirs: string[] = [];
  for (const cat of categories) {
    const catDir = path.join(guidesDir, cat);
    if (!fs.existsSync(catDir)) continue;
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(`guides/${cat}/${entry.name}`);
    }
  }
  return dirs;
}

const completion = omelette('gd <command> <arg1> <arg2>');

completion.on('command', ({ reply }) => {
  reply(['dev', 'dev-all', 'grade', 'test', 'gen', 'audit', 'eval', 'setup-completion']);
});

completion.on('arg1', ({ before, reply }) => {
  if (before === 'eval') {
    reply(['suite', 'task', 'smoke', 'agent', 'report', 'dashboard']);
  } else if (before === 'gen') {
    reply(['grader', 'negative']);
  } else if (['dev', 'test', 'grade'].includes(before)) {
    reply(listGuideDirs());
  }
});

completion.on('arg2', ({ before, line, reply }) => {
  if (before === 'task' && line.includes('eval')) {
    const tasksDir = path.join(rootDir, 'harness', 'tasks');
    if (fs.existsSync(tasksDir)) {
      reply(fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')));
    }
  } else if (before === 'agent' && line.includes('eval')) {
    const baseAppsDir = path.join(rootDir, 'harness', 'base_apps');
    if (fs.existsSync(baseAppsDir)) {
      reply(fs.readdirSync(baseAppsDir).filter(d => fs.statSync(path.join(baseAppsDir, d)).isDirectory()));
    }
  } else if (['grader', 'negative'].includes(before) && line.includes('gen')) {
    reply(listGuideDirs());
  }
});

completion.init();

// --- Argument Parsing ---

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
    grade: { type: 'boolean' },
    'test-grader': { type: 'boolean' },
    'gen-grader': { type: 'boolean' },
    'gen-negative': { type: 'boolean' },
    verbose: { type: 'boolean' },
  },
  allowPositionals: true,
  strict: false,
});

// --- Helpers ---

function spawnChild(command: string, args: string[], options: import('child_process').SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: 'inherit', cwd: rootDir, ...options });
    p.on('close', (code) => resolve(code ?? 0));
    p.on('error', (err) => reject(err));
  });
}

function runNpm(args: string[]) {
  return spawnChild('pnpm', args);
}

function requireArg(arg: string | undefined, usage: string): string {
  if (!arg) {
    console.error(`${cRed('Missing argument.')} Usage: ${usage}`);
    process.exit(1);
  }
  return arg;
}

// --- Command Routing ---

async function main() {
  const command = positionals[0];

  if (values.help || !command) {
    console.log(`
Guidance CLI (gd)

Usage: gd <command> [options]

Guide Development:
  dev <dir> [options]         Auto-generate and calibrate guide artifacts
  dev-all                     Batch-process all incomplete guides
  audit                       Show status of all guides

Options for 'dev':
  --grade              Run/calibrate grader
  --test-grader        Check grader calibration (demo + negative-demo)
  --gen-grader         Generate a new grader script
  --gen-negative       Generate negative examples
  --verbose            Show additional output

Evaluation:
  eval suite                  Run the full evaluation suite
  eval task <id>              Run a specific task
  eval smoke                  Run the quick smoke test
  eval agent <tmpl> <prompt>  Run an agent against a template
  eval report                 Generate an evaluation report
  eval dashboard              Start the evaluation dashboard

Other:
  setup-completion            Install shell auto-completion

Options:
  -h, --help      Show this help
  --verbose       Show additional output
    `);
    process.exit(0);
  }

  switch (command) {
    case 'setup-completion': {
      completion.setupShellInitFile();
      console.log('Auto-completion installed. Restart your terminal to apply.');
      process.exit(0);
    }

    case 'dev': {
      const dir = requireArg(positionals[1], 'gd dev <path/to/guide>');
      if (values.grade) {
        const { gradeFile } = await import('../guides/run-grader.ts');
        await gradeFile(path.resolve(process.cwd(), dir));
        break;
      }
      if (values['test-grader']) {
        const { testGrader } = await import('../guides/test-grader.ts');
        const result = await testGrader(dir);
        process.exit(result.success ? 0 : 1);
      }
      if (values['gen-grader']) {
        const { generateGrader } = await import('../guides/grader-gen.ts');
        await generateGrader(dir);
        break;
      }
      if (values['gen-negative']) {
        const { generateNegative } = await import('../guides/negative-gen.ts');
        await generateNegative(dir);
        break;
      }
      // Default dev-guide pipeline
      const { devGuide } = await import('../guides/dev-guide.ts');
      const success = await devGuide(dir, {
        verbose: !!values.verbose,
      });
      process.exit(success ? 0 : 1);
    }

    case 'dev-all': {
      const { devAll } = await import('../guides/dev-guide.ts');
      await devAll({ verbose: !!values.verbose });
      break;
    }

    case 'audit': {
      const { auditGuides } = await import('../guides/dev-guide.ts');
      auditGuides();
      break;
    }

    case 'eval': {
      const action = requireArg(positionals[1], 'gd eval <suite|task|smoke|agent|report|dashboard>');
      switch (action) {
        case 'suite': {
          const buildCode = await runNpm(['build:mcp']);
          if (buildCode !== 0) process.exit(buildCode);
          const { runSuite } = await import('../harness/run_suite.ts');
          await runSuite();
          break;
        }
        case 'task': {
          const id = requireArg(positionals[2], 'gd eval task <task-id>');
          const { runSingleTask } = await import('../harness/run_suite.ts');
          await runSingleTask(id);
          break;
        }
        case 'smoke': {
          const { runSmokeTest } = await import('../harness/quick-smoke.ts');
          await runSmokeTest();
          break;
        }
        case 'agent': {
          const tmpl = requireArg(positionals[2], 'gd eval agent <template> <prompt>');
          const prompt = requireArg(positionals[3], 'gd eval agent <template> <prompt>');
          const { runAgent } = await import('../harness/run_suite.ts');
          await runAgent(tmpl, prompt);
          break;
        }
        case 'report': {
          const { evaluate } = await import('../harness/evaluate.ts');
          await evaluate();
          break;
        }
        case 'dashboard': {
          process.chdir(path.join(rootDir, 'eval-view'));
          await import('../eval-view/server.js');
          break;
        }
        default:
          console.error(`${cRed(`Unknown eval command: ${action}.`)} Run 'gd --help' for usage.`);
          process.exit(1);
      }
      break;
    }

    default: {
      // Legacy fallbacks — guide namespace was flattened
      if (command === 'guide') {
        const action = positionals[1] || '';
        const remap: Record<string, string> = {
          'dev': 'dev', 'dev-all': 'dev-all', 'grade': 'grade',
          'test-grader': 'test', 'gen-grader': 'gen grader', 'gen-negative': 'gen negative',
        };
        if (remap[action]) {
          const rest = positionals.slice(2).join(' ');
          console.error(`${cRed(`'gd guide ${action}' has moved.`)}  Run: ${cCyan(`gd ${remap[action]}${rest ? ' ' + rest : ''}`)}\n`);
        } else {
          console.error(`${cRed(`The 'guide' namespace has been removed.`)} Run ${cCyan('gd --help')} for the new commands.\n`);
        }
      } else if (['suite', 'task', 'smoke', 'agent', 'report', 'dashboard'].includes(command)) {
        console.error(`${cRed(`'gd ${command}' has moved.`)}  Run: ${cCyan(`gd eval ${command}`)}\n`);
      } else if (['grade'].includes(command)) {
        console.error(`${cRed(`'gd grade' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --grade`)}\n`);
      } else if (['test', 'test-grader'].includes(command)) {
        console.error(`${cRed(`'gd test' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --test-grader`)}\n`);
      } else if (['gen', 'gen-grader', 'gen-negative', 'gen:grader', 'gen:negative'].includes(command)) {
        const rest = positionals.slice(1).join(' ');
        console.error(`${cRed(`'gd ${command}' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --gen-grader`)} or ${cCyan(`--gen-negative`)}\n`);
      } else {
        console.error(`${cRed(`Unknown command: ${command}.`)} Run ${cCyan('gd --help')} for usage.`);
      }
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
