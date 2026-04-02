#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from 'util';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import omelette from 'omelette';
import { pathToFileURL } from 'url';
import { cRed, cCyan, cBold, cDim } from '../lib/colors.ts';
import { Serving, mergeSuiteConfig, type SuiteConfig } from '../harness/config.ts';
import { rootDir, guidesDir, baseAppsDir, evalViewDir } from '../lib/paths.ts';
import { getTaskMap } from '../lib/guide-validation.ts';

// Load environment variables (Node 20.12+)
try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  // Ignore if file doesn't exist
}

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

const completion = omelette('gd <command> <arg1> <arg2>');

completion.on('command', ({ reply }) => {
  reply(['dev', 'dev-all', 'grade', 'test', 'gen', 'audit', 'eval', 'run', 'dashboard', 'deploy', 'upload', 'baselinestatus', 'setup-completion']);
});

completion.on('arg1', ({ before, reply }) => {
  if (before === 'eval') {
    const tasks = Array.from(getTaskMap().keys());
    reply(['suite', ...tasks]);
  } else if (before === 'gen') {
    reply(['grader', 'negative']);
  } else if (['dev', 'test', 'grade'].includes(before)) {
    reply(listGuideDirs());
  }
});

completion.on('arg2', ({ before, line, reply }) => {
  if (before === 'run') {
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
    guided: { type: 'boolean' },
    verbose: { type: 'boolean' },
    usecases: { type: 'boolean' },
    config: { type: 'string' },
  },
  allowPositionals: true,
  strict: false,
});

// --- Helpers ---

async function resolveSuiteConfig(configPath?: string): Promise<SuiteConfig> {
  const resolvedConfigPath = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.resolve(rootDir, 'config.ts');

  let overrides: any = {};
  if (fs.existsSync(resolvedConfigPath)) {
    const fileUrl = pathToFileURL(resolvedConfigPath).href;
    const customConfig = await import(fileUrl);
    overrides = customConfig.default || customConfig;
  } else if (configPath) {
    console.error(cRed('⚠️ Specified config file not found: ' + resolvedConfigPath));
    process.exit(1);
  }

  return mergeSuiteConfig(overrides);
}

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
${cBold('Guidance CLI')}

${cCyan('Usage:')} gd <command> [options]

${cBold('Guide Development:')}
  ${cCyan('audit')}                  Show status of all guides
  ${cCyan('dev')} <dir> [options]    Auto-generate and calibrate guide artifacts

${"Piece-wise options for `dev`:"}
    ${cDim('--grade')}              Run/calibrate grader
    ${cDim('--test-grader')}        Check grader calibration (demo + negative-demo)
    ${cDim('--gen-grader')}         Generate a new grader script
    ${cDim('--gen-negative')}       Generate negative examples
    ${cDim('--guided')}             Skip calibration, run guided agent test only
    ${cDim('--no-test')}            Skip agent tests after calibration
    ${cDim('--verbose')}            Show additional output

${cBold('Evaluation:')}
  ${cCyan('eval')} [suite|tasks...]  Run the full evaluation suite, or specific tasks
  ${cCyan('dashboard')}              Start the evaluation dashboard
  ${cCyan('run')} <tmpl> <prompt>    Run an ad-hoc agent test against a template
  ${cCyan('deploy')}                 Deploy the dashboard to GitHub Pages
  ${cCyan('upload')} <suite>         Upload generated evaluation suite to GCS

${cBold('Other:')}
  ${cCyan('baselinestatus')} <query>      Check browser support and Baseline status
  ${cCyan('setup-completion')}            Install shell auto-completion

${cBold('Options:')}
  ${cDim('-h, --help')}                 Show this help
  ${cDim('--verbose')}                  Show additional output
  ${cDim('--usecases')}                 (Audit) Group by categories/usecases (default is features)
  ${cDim('--config <custom_config>')}   (Eval) Path to a custom TS suite config file (defaults to config.ts, or falls back to defaults in harness/config.ts)
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
      const mergedSuiteConfig = await resolveSuiteConfig(values.config as string | undefined);
      const success = await devGuide(dir, {
        guidedOnly: !!values.guided,
        verbose: !!values.verbose,
        suiteConfig: mergedSuiteConfig,
      });
      process.exit(success ? 0 : 1);
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
          console.error(`${cRed(`'gd guide ${action}' has moved.`)}  Run: ${cCyan(`gd ${remap[action]}${rest ? ' ' + rest : ''}`)}\n`);
        } else {
          console.error(`${cRed(`The 'guide' namespace has been removed.`)} Run ${cCyan('gd --help')} for the new commands.\n`);
        }
      } else if (['suite', 'task', 'smoke', 'report'].includes(command)) {
        console.error(`${cRed(`'gd ${command}' has moved.`)}  Run: ${cCyan(`gd eval ${command}`)}\n`);
      } else if (command === 'agent') {
        console.error(`${cRed(`'gd agent' has moved.`)}  Run: ${cCyan(`gd run <template> <prompt>`)}\n`);
      } else if (['grade'].includes(command)) {
        console.error(`${cRed(`'gd grade' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --grade`)}\n`);
      } else if (['test', 'test-grader'].includes(command)) {
        console.error(`${cRed(`'gd test' has moved.`)}  Run: ${cCyan(`gd dev <guide_dir> --test-grader`)}\n`);
      } else if (['gen', 'gen-grader', 'gen-negative', 'gen:grader', 'gen:negative'].includes(command)) {
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
