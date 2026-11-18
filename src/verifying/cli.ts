/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatContextGuidesReport, resolveContextGuides } from './context-guides.ts';
import { installPluginConfigs } from './critic-agent.ts';
import { runStopHook } from './stop-hook.ts';
import { runVerification } from './verify.ts';

export { installPluginConfigs, runStopHook, resolveContextGuides, runVerification };

const SELF_SCRIPT_PATH = fileURLToPath(import.meta.url);

export const VERIFY_CLI_HELP = `
Usage:
  modern-web-guidance verify [workspace] [options]
  modern-web-guidance context-guides [workspace] [options]
  modern-web-guidance install-hooks [--target antigravity|claude|cursor|all] [--dir <projectDir>]

Verify Options:
  -w, --workspace <dir>     Target web project directory (default: cwd)
  -u, --url <url>           Verify an explicit running server URL
  -p, --port <port>         Expected dev server port override
  -r, --route <path>        Explicit route to probe (repeatable, e.g. -r /checkout -r /cart)
      --pack <name>         Vertical pack: commerce | media | saas | auto | none (default: auto)
      --perf                Run opt-in CDP Perf & Memory UX pass (CLS, LCP, LoAF, heap, listeners)
      --dev-cmd <cmd>       Custom command to boot dev server headlessly
      --no-boot             Do not auto-boot dev server if port is not listening
      --no-smoke            Skip interactive click/Escape smoke probe
      --static-only         Run only the static Modernity + ESLint + Pack pass (no browser/server)
      --all                 Scan all workspace files instead of git diff
      --strict              Exit non-zero on warnings as well as errors
      --require-browser     Require live browser/server verification (default: true unless --static-only)
      --allow-no-browser    Downgrade missing browser/server errors to advisory warnings
      --json                Emit machine-readable JSON report
  -h, --help                Show this help message

Context-Guides Options:
  -w, --workspace <dir>     Target web project directory (default: cwd)
      --pack <name>         Vertical pack boost: commerce | media | saas | auto | none
  -l, --limit <n>           Maximum MWG guides to return (default: 8)
      --include-content     Inline verbatim .md guide bodies from the local corpus
      --all                 Inspect all workspace files instead of git diff
      --json                Emit machine-readable JSON report
`.trim();

export interface VerifyingCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function isValidDirectory(dirPath: string): boolean {
  try {
    return existsSync(dirPath) && statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function stripSkillVersionArgs(rawArgs: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--skill-version') {
      i += 1;
      continue;
    }
    if (rawArgs[i].startsWith('--skill-version=')) {
      continue;
    }
    out.push(rawArgs[i]);
  }
  return out;
}

export async function runVerifyingCli(
  subcommand: 'verify' | 'context-guides' | 'stop-hook' | 'install-hooks' | 'install-plugin',
  rawArgs: readonly string[],
): Promise<VerifyingCliResult> {
  const cleanArgs = stripSkillVersionArgs(rawArgs);

  if (subcommand === 'stop-hook') {
    let rawStdin = '';
    try {
      rawStdin = readFileSync(0, 'utf8');
    } catch {
      rawStdin = '';
    }
    try {
      const out = await runStopHook(rawStdin);
      return { exitCode: 0, stdout: `${JSON.stringify(out)}\n`, stderr: '' };
    } catch {
      return { exitCode: 0, stdout: '{}\n', stderr: '' };
    }
  }

  if (subcommand === 'install-hooks' || subcommand === 'install-plugin') {
    let parsed;
    try {
      parsed = parseArgs({
        args: cleanArgs,
        options: {
          target: { type: 'string', short: 't', default: 'all' },
          dir: { type: 'string', short: 'd', default: process.cwd() },
          help: { type: 'boolean', short: 'h', default: false },
        },
        strict: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { exitCode: 1, stdout: '', stderr: `Error: ${msg}\n` };
    }

    if (parsed.values.help) {
      return { exitCode: 0, stdout: `${VERIFY_CLI_HELP}\n`, stderr: '' };
    }

    try {
      const files = installPluginConfigs(
        parsed.values.target ?? 'all',
        path.resolve(parsed.values.dir ?? process.cwd()),
        SELF_SCRIPT_PATH,
      );
      return {
        exitCode: 0,
        stdout: `Installed modern-web-guidance Stop hook + modern-web-critic subagent:\n${files.map((f) => `  - ${f}`).join('\n')}\n`,
        stderr: '',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exitCode: 1,
        stdout: '',
        stderr: `❌ FAIL modern-web-guidance ${subcommand}: ${msg}\n`,
      };
    }
  }

  if (subcommand === 'context-guides') {
    let parsed;
    try {
      parsed = parseArgs({
        args: cleanArgs,
        allowPositionals: true,
        options: {
          workspace: { type: 'string', short: 'w' },
          pack: { type: 'string' },
          limit: { type: 'string', short: 'l' },
          'include-content': { type: 'boolean', default: false },
          all: { type: 'boolean', default: false },
          json: { type: 'boolean', default: false },
          help: { type: 'boolean', short: 'h', default: false },
        },
        strict: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { exitCode: 1, stdout: '', stderr: `Error: ${msg}\n` };
    }

    if (parsed.values.help) {
      return { exitCode: 0, stdout: `${VERIFY_CLI_HELP}\n`, stderr: '' };
    }

    const workspaceDir = path.resolve(
      parsed.values.workspace || parsed.positionals[0] || process.cwd(),
    );
    if (!isValidDirectory(workspaceDir)) {
      const errMsg = `Workspace directory does not exist: ${workspaceDir}`;
      if (parsed.values.json) {
        return {
          exitCode: 1,
          stdout: `${JSON.stringify({ passed: false, workspaceDir, error: errMsg }, null, 2)}\n`,
          stderr: '',
        };
      }
      return {
        exitCode: 1,
        stdout: '',
        stderr: `❌ FAIL modern-web-guidance context-guides: ${errMsg}\n`,
      };
    }

    try {
      const result = await resolveContextGuides({
        workspaceDir,
        pack: parsed.values.pack,
        limit: parsed.values.limit ? Number(parsed.values.limit) : 8,
        includeContent: Boolean(parsed.values['include-content']),
        allFiles: Boolean(parsed.values.all),
      });
      if (parsed.values.json) {
        return { exitCode: 0, stdout: `${JSON.stringify(result, null, 2)}\n`, stderr: '' };
      }
      return { exitCode: 0, stdout: `${formatContextGuidesReport(result)}\n`, stderr: '' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exitCode: 1,
        stdout: '',
        stderr: `❌ FAIL modern-web-guidance context-guides: ${msg}\n`,
      };
    }
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: cleanArgs,
      allowPositionals: true,
      options: {
        workspace: { type: 'string', short: 'w' },
        url: { type: 'string', short: 'u' },
        port: { type: 'string', short: 'p' },
        route: { type: 'string', short: 'r', multiple: true },
        pack: { type: 'string' },
        perf: { type: 'boolean', default: false },
        'dev-cmd': { type: 'string' },
        'no-boot': { type: 'boolean', default: false },
        'no-smoke': { type: 'boolean', default: false },
        'static-only': { type: 'boolean', default: false },
        all: { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
        'require-browser': { type: 'boolean', default: true },
        'allow-no-browser': { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, stdout: '', stderr: `Error: ${msg}\n` };
  }

  if (parsed.values.help) {
    return { exitCode: 0, stdout: `${VERIFY_CLI_HELP}\n`, stderr: '' };
  }

  const workspaceDir = path.resolve(
    parsed.values.workspace || parsed.positionals[0] || process.cwd(),
  );
  if (!isValidDirectory(workspaceDir)) {
    const errMsg = `Workspace directory does not exist: ${workspaceDir}`;
    if (parsed.values.json) {
      return {
        exitCode: 1,
        stdout: `${JSON.stringify(
          {
            passed: false,
            workspaceDir,
            errorCount: 1,
            warningCount: 0,
            infraFailed: true,
            infraWarning: errMsg,
            findings: [],
          },
          null,
          2,
        )}\n`,
        stderr: '',
      };
    }
    return {
      exitCode: 1,
      stdout: '',
      stderr: `❌ FAIL modern-web-guidance verify: ${errMsg}\n`,
    };
  }

  const requireBrowser = parsed.values['static-only']
    ? false
    : parsed.values['allow-no-browser']
      ? false
      : Boolean(parsed.values['require-browser']);

  try {
    const report = await runVerification({
      workspaceDir,
      url: parsed.values.url,
      port: parsed.values.port ? Number(parsed.values.port) : undefined,
      routes: parsed.values.route,
      pack: parsed.values.pack,
      perf: Boolean(parsed.values.perf),
      devCmd: parsed.values['dev-cmd'],
      boot: !parsed.values['no-boot'],
      smokeProbe: !parsed.values['no-smoke'],
      staticOnly: Boolean(parsed.values['static-only']),
      allFiles: Boolean(parsed.values.all),
      strict: Boolean(parsed.values.strict),
      requireBrowser,
    });

    if (parsed.values.json) {
      return {
        exitCode: report.passed ? 0 : 1,
        stdout: `${JSON.stringify(report, null, 2)}\n`,
        stderr: '',
      };
    }
    return {
      exitCode: report.passed ? 0 : 1,
      stdout: `${report.formatted}\n`,
      stderr: '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (parsed.values.json) {
      return {
        exitCode: 1,
        stdout: `${JSON.stringify({ passed: false, errorCount: 1, error: msg }, null, 2)}\n`,
        stderr: '',
      };
    }
    return {
      exitCode: 1,
      stdout: '',
      stderr: `❌ FAIL modern-web-guidance verify: ${msg}\n`,
    };
  }
}

export function writeVerifyingCliResult(result: VerifyingCliResult): number {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
  return result.exitCode;
}

function isExecutedDirectly(): boolean {
  if (!process.argv[1]) return false;
  if (import.meta.main) return true;
  if (process.argv[1].endsWith('verify.mjs')) return true;
  try {
    return realpathSync(SELF_SCRIPT_PATH) === realpathSync(path.resolve(process.argv[1]));
  } catch {
    return path.resolve(SELF_SCRIPT_PATH) === path.resolve(process.argv[1]);
  }
}

if (isExecutedDirectly()) {
  const argv = process.argv.slice(2);
  let sub: 'verify' | 'context-guides' | 'stop-hook' | 'install-hooks' | 'install-plugin' =
    'verify';
  if (
    argv[0] === 'verify' ||
    argv[0] === 'context-guides' ||
    argv[0] === 'stop-hook' ||
    argv[0] === 'install-hooks' ||
    argv[0] === 'install-plugin'
  ) {
    sub = argv.shift() as typeof sub;
  }
  runVerifyingCli(sub, argv)
    .then(writeVerifyingCliResult)
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.stack || err.message : String(err);
      process.stderr.write(`modern-web-guidance verify failed: ${msg}\n`);
      process.exitCode = 2;
    });
}
