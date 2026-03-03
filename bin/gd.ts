#!/usr/bin/env node --experimental-strip-types

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

yargs(hideBin(process.argv))
  .scriptName('gd')
  .usage('$0 <cmd> [args]')

  // 1. Execution Commands
  .command('suite', 'Run the evaluation suite', () => {}, async (argv) => {
    const code1 = await runNpm(['build:mcp']);
    if (code1 !== 0) process.exit(code1);
    const code2 = await runNpm(['--filter', 'harness', 'suite', ...(argv._.slice(1) as string[])]);
    process.exit(code2);
  })
  .command('task [id]', 'Run a specific task', (yargs) => {
    return yargs.positional('id', {
      describe: 'ID or Name of the task to run',
      type: 'string'
    });
  }, async (argv) => {
    const extraArgs = argv.id ? [argv.id] : [];
    const code = await runNpm(['--filter', 'harness', 'task', ...extraArgs, ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })
  .command('smoke', 'Run the quick smoke test', () => {}, async (argv) => {
    const code = await runNpm(['--filter', 'harness', 'qsmoke', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })
  .command('agent', 'Run the evaluation suite with an agent template', () => {}, async (argv) => {
    const code = await runNode(['harness/run_suite.ts', '--with-template', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })

  // 2. Evaluation & Reporting
  .command('report', 'Generate an evaluation report', () => {}, async (argv) => {
    const code = await runNpm(['--filter', 'harness', 'report', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })
  .command('grade', 'Run the grader', () => {}, async (argv) => {
    const code = await runNode(['--experimental-strip-types', 'guides/run-grader.ts', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })

  // 3. Tooling & Dashboard
  .command('dashboard', 'Start the evaluation dashboard', () => {}, async (argv) => {
    const code = await runNpm(['--filter', 'eval-view', 'start', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })
  .command('gen:grader', 'Generate a new grader', () => {}, async (argv) => {
    const code = await runNode(['--env-file=.env', '--experimental-strip-types', 'guides/grader-gen.ts', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })
  .command('gen:negative', 'Generate negative examples', () => {}, async (argv) => {
    const code = await runNode(['--env-file=.env', '--experimental-strip-types', 'guides/negative-gen.ts', ...(argv._.slice(1) as string[])]);
    process.exit(code);
  })

  .completion('completion', 'Generate completion script (e.g. `gd completion >> ~/.zshrc`)')
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .strict()
  .parse();
