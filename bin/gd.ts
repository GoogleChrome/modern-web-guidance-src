#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import omelette from 'omelette';
import { cRed, cCyan, cBold, cDim } from '../lib/colors.ts';
import { Serving, resolveSuiteConfig } from '../harness/config.ts';
import { rootDir, guidesDir, baseAppsDir, evalViewDir } from '../lib/paths.ts';
import { getTaskMap } from '../lib/guide-validation.ts';

// Load environment variables (Node 20.12+)
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  // Ignore if file doesn't exist
}

// --- Single Source of Truth Metadata ---

const ALL_OPTIONS = {
  help: { type: 'boolean', short: 'h', desc: 'Show this help' },
  version: { type: 'boolean', short: 'v', desc: 'Show version' },
  grade: { type: 'boolean', desc: 'Run/calibrate grader' },
  'test-grader': { type: 'boolean', desc: 'Check grader calibration (demo + negative-demo)' },
  'gen-grader': { type: 'boolean', desc: 'Generate a new grader script' },
  'gen-negative': { type: 'boolean', desc: 'Generate negative examples' },
  guided: { type: 'boolean', desc: 'Skip calibration, run guided agent test only' },
  verbose: { type: 'boolean', desc: 'Show additional output' },
  usecases: { type: 'boolean', desc: 'Group by usecases rather than features' },
  config: { type: 'string', desc: 'Custom config file (defaults to root config.ts)' },
  ui: { type: 'boolean', desc: 'Start the evaluation review UI' },
  'no-test': { type: 'boolean', desc: 'Skip agent tests after calibration' },
  'cross-app': { type: 'boolean', desc: 'Also check grader on an unmodified base app' },
  category: { type: 'string', desc: 'Guide category' },
  slug: { type: 'string', desc: 'Guide directory name' },
} as const;

type OptionName = keyof typeof ALL_OPTIONS;

const COMMAND_METADATA = {
  audit: { desc: 'Show status of all guides', flags: ['usecases'] },
  dev: { desc: 'Auto-generate and calibrate guide artifacts', flags: ['grade', 'test-grader', 'gen-grader', 'gen-negative', 'guided', 'no-test', 'cross-app'] },
  eval: { desc: 'Run the full evaluation suite, or specific tasks', flags: ['config', 'ui'] },
  dashboard: { desc: 'Start the evaluation dashboard', flags: [] },
  run: { desc: 'Run an ad-hoc agent test against a template', flags: ['config'] },
  deploy: { desc: 'Deploy the dashboard to GitHub Pages', flags: [] },
  upload: { desc: 'Upload generated evaluation suite to GCS', flags: [] },
  backfill: { desc: 'Backfill metrics for historical suites', flags: [] },
  baselinestatus: { desc: 'Check browser support and Baseline status', flags: [] },
  'gen-guide': { desc: 'Generate guide.md, demo.html, expectations.md from a web-feature-id', flags: ['category', 'slug'] },

  'setup-completion': { desc: 'Install shell auto-completion', flags: [] },
} satisfies Record<string, { desc: string; flags: OptionName[] }>;

const COMMANDS = Object.keys(COMMAND_METADATA);
type CommandName = keyof typeof COMMAND_METADATA;

// --- Shell Auto-Completion ---

function listGuideDirs(): string[] {
  if (!fs.existsSync(guidesDir)) return [];
  const categories = fs.readdirSync(guidesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);
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

function getFlagsForLine(line: string): string[] {
  const parts = line.split(/\s+/).filter(Boolean);
  const cmd = parts[1] as CommandName;
  const meta = COMMAND_METADATA[cmd];
  const baseFlags = meta ? meta.flags : [];
  return [...new Set([...baseFlags, 'verbose'])].map(f => '--' + f);
}

const completion = omelette('gd <command> <arg1> <arg2> <arg3> <arg4> <arg5>');

completion.on('command', ({ reply }) => reply(COMMANDS));

completion.on('arg1', ({ before, line, reply }) => {
  const flags = getFlagsForLine(line);
  if (before === 'eval') {
    const tasks = Array.from(getTaskMap().keys());
    reply(['suite', ...tasks, ...listGuideDirs(), ...flags]);
  } else if (before === 'gen') {
    reply(['grader', 'negative']);
  } else if (before === 'audit') {
    reply(flags);
  } else if (['dev', 'test', 'grade'].includes(before)) {
    reply([...listGuideDirs(), ...flags]);
  } else {
    reply(flags);
  }
});

completion.on('arg2', ({ before, line, reply }) => {
  const flags = getFlagsForLine(line);
  if (line.includes('gd eval')) {
    reply(flags);
  } else if (line.includes('gd dev') && before.startsWith('guides/')) {
    reply(flags);
  } else if (before === 'run') {
    if (fs.existsSync(baseAppsDir)) {
      reply(fs.readdirSync(baseAppsDir).filter(d => fs.statSync(path.join(baseAppsDir, d)).isDirectory()));
    }
  } else if (['grader', 'negative'].includes(before) && line.includes('gen')) {
    reply(listGuideDirs());
  } else {
    reply(flags);
  }
});

completion.on('arg3', ({ line, reply }) => reply(getFlagsForLine(line)));
completion.on('arg4', ({ line, reply }) => reply(getFlagsForLine(line)));
completion.on('arg5', ({ line, reply }) => reply(getFlagsForLine(line)));

completion.init();

// --- Argument Parsing ---

const parseOptions: any = {};
for (const [key, val] of Object.entries(ALL_OPTIONS)) {
  parseOptions[key] = { type: val.type };
  if ((val as any).short) parseOptions[key].short = (val as any).short;
}

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: parseOptions,
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

function showHelp() {
  const groups = [
    {
      title: 'Guide Development',
      commands: ['dev', 'audit', 'gen-guide'],
    },

    {
      title: 'Evaluation & Dashboard',
      commands: ['eval', 'run', 'dashboard', 'deploy', 'upload', 'backfill'],
    },
    {
      title: 'Utilities & Setup',
      commands: ['baselinestatus', 'setup-completion'],
    },
  ] as const;

  // AI-First Safety: Enforce at compile-time that every command is documented in the help text
  type AssertEmpty<_T extends never> = true;
  type _CheckAllCmdsRendered = AssertEmpty<Exclude<CommandName, typeof groups[number]['commands'][number]>>;

  // AI-First Safety: Enforce that every flag in ALL_OPTIONS is assigned to a command or rendered globally
  type GlobalFlags = 'help' | 'version' | 'verbose';
  type CmdFlags = typeof COMMAND_METADATA[keyof typeof COMMAND_METADATA]['flags'][number];
  type _CheckAllFlagsRendered = AssertEmpty<Exclude<OptionName, GlobalFlags | CmdFlags>>;

  console.log(`\n${cCyan('Usage:')} gd <command> [options]\n`);

  for (const group of groups) {
    console.log(cBold(group.title));
    for (const cmd of group.commands) {
      const meta = COMMAND_METADATA[cmd as CommandName];
      if (!meta) continue;

      const args = cmd === 'dev' ? ' <dir>' : cmd === 'run' ? ' <tmpl> <prompt>' : cmd === 'eval' ? ' [suite|tasks...]' : cmd === 'baselinestatus' ? ' <query>' : '';
      console.log(`  ${cCyan((cmd + args).padEnd(28))} ${meta.desc}`);

      if (meta.flags.length > 0) {
        for (const flagName of meta.flags) {
          const optVal = ALL_OPTIONS[flagName];
          const arg = flagName === 'config' ? ' <path>' : '';
          console.log(`    ${cDim(('--' + flagName + arg).padEnd(26))} ${optVal.desc}`);
        }
      }
    }
    console.log('');
  }

  console.log(cBold('Global Options:'));
  console.log(`  ${cDim('-h, --help'.padEnd(28))} Show this help`);
  console.log(`  ${cDim('-v, --version'.padEnd(28))} Show version`);
  console.log(`  ${cDim('    --verbose'.padEnd(28))} ${ALL_OPTIONS.verbose.desc}\n`);
}

async function main() {
  const command = positionals[0];

  if (values.help || !command) {
    showHelp();
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
      const mergedSuiteConfig = await resolveSuiteConfig(values.config as string | undefined);
      const success = await devGuide(dir, {
        guidedOnly: !!values.guided,
        verbose: !!values.verbose,
        test: !values['no-test'],
        suiteConfig: mergedSuiteConfig,
      });
      process.exit(success ? 0 : 1);
    }

    case 'gen-guide': {
      const featureId = requireArg(positionals[1], 'gd gen-guide <web-feature-id> [<reviewer-github-username>]');
      const reviewer = requireArg(positionals[2], 'gd gen-guide <web-feature-id> [<reviewer-github-username>]');
      const { generateUseCases } = await import('../guides/guide-gen.ts');
      await generateUseCases(featureId, reviewer);
      break;
    }

    // not documented because it's UBER-powerful.
    case 'dev-all': {
      const { devAll } = await import('../guides/dev-guide.ts');
      await devAll({ verbose: !!values.verbose });
      break;
    }

    case 'audit': {
      const { auditGuides } = await import('../guides/dev-guide.ts');
      auditGuides({ groupByUsecases: !!values.usecases });
      break;
    }

    case 'run': {
      const tmpl = requireArg(positionals[1], 'gd run <template> <prompt>');
      const prompt = requireArg(positionals[2], 'gd run <template> <prompt>');

      const mergedSuiteConfig = await resolveSuiteConfig(values.config as string | undefined);

      const { runAgent } = await import('../harness/run_suite.ts');
      await runAgent(tmpl, prompt, mergedSuiteConfig);
      break;
    }

    case 'dashboard': {
      process.chdir(evalViewDir);
      await import('../eval-view/server.js');
      break;
    }

    case 'eval': {
      const tasks = positionals.slice(1).filter(a => a !== 'suite');
      if (values['ui']) {
        process.env.LAUNCH_UI = 'true';
        process.chdir(evalViewDir);
        await import('../eval-view/server.js');
        break;
      }

      const mergedSuiteConfig = await resolveSuiteConfig(values.config as string | undefined);

      let buildCode = 0;
      if (mergedSuiteConfig.serving === Serving.MCP) {
        buildCode = await runNpm(['build:mcp']);
      } else if (mergedSuiteConfig.serving === Serving.SKILLS_CLI) {
        buildCode = await runNpm(['--filter', 'serving', 'build-dist']);
      }

      if (buildCode !== 0) process.exit(buildCode);

      const { runSuite } = await import('../harness/run_suite.ts');

      const runOptions: any = { suiteConfig: mergedSuiteConfig }; // Pass the merged config
      if (tasks.length > 0) runOptions.tasks = tasks;

      await runSuite(runOptions);
      break;
    }

    case 'upload': {
      const args = positionals.slice(1);
      const code = await runNpm(['upload', ...args]);
      process.exit(code);
    }

    case 'backfill': {
      const { runBackfill } = await import('../harness/backfill.ts');
      await runBackfill();
      break;
    }

    case 'deploy': {
      const code = await runNpm(['deploy:dashboard']);
      process.exit(code);
    }

    case 'baselinestatus': {
      const args = positionals.slice(1);
      const code = await runNpm(['baselinestatus', ...args]);
      process.exit(code);
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
          console.error(cRed("gd guide " + action + " has moved.") + "  Run: " + cCyan("gd " + remap[action] + (rest ? " " + rest : "")) + "\n");
        } else {
          console.error(cRed("The 'guide' namespace has been removed.") + " Run " + cCyan("gd --help") + " for the new commands.\n");
        }
      } else if (['suite', 'task', 'smoke', 'report'].includes(command)) {
        console.error(cRed("'gd " + command + "' has moved.") + "  Run: " + cCyan("gd eval " + command) + "\n");
      } else if (command === 'agent') {
        console.error(cRed("'gd agent' has moved.") + "  Run: " + cCyan("gd run <template> <prompt>") + "\n");
      } else if (['grade'].includes(command)) {
        console.error(cRed("'gd grade' has moved.") + "  Run: " + cCyan("gd dev <guide_dir> --grade") + "\n");
      } else if (['test', 'test-grader'].includes(command)) {
        console.error(cRed("'gd test' has moved.") + "  Run: " + cCyan("gd dev <guide_dir> --test-grader") + "\n");
      } else if (['gen', 'gen-grader', 'gen-negative', 'gen:grader', 'gen:negative'].includes(command)) {
        console.error(cRed("'gd " + command + "' has moved.") + "  Run: " + cCyan("gd dev <guide_dir> --gen-grader") + " or " + cCyan("--gen-negative") + "\n");
      } else {
        console.error(cRed("Unknown command: " + command + ".") + " Run " + cCyan("gd --help") + " for usage.");
      }
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
