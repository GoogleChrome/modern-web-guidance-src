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

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { VerificationFinding, VerifyReport, VerifyingCliResult } from './types.ts';
import { runVerify } from './verify.ts';

export const VERIFY_USAGE = `Usage: modern-web-guidance verify <url> [options]
       modern-web-guidance verify --dir <path> [options]

Verify a live rendered web page (and/or local source directory) against
Modern Web Guidance runtime, layout, accessibility, and CWV checks.

Options:
  --mobile                 Emulate mobile viewport (390x844, DPR 3, touch)
  --cpu-throttle <rate>    Apply CDP CPU throttling multiplier (e.g. 4)
  --baseline <path>        Suppress findings already present in a baseline JSON report
  --dir <path>             Also run legacy-scan static checks on a local directory
  --no-smoke               Skip interactive click and Escape focus-trap probing
  --chrome <path>          Explicit Chrome/Chromium executable path
  --timeout <ms>           Browser launch/navigation timeout in ms (default: 10000)
  --json                   Output structured JSON report
  --github                 Output GitHub Actions workflow annotations
  -h, --help               Show this help
`;

export function formatGithubAnnotations(findings: readonly VerificationFinding[]): string {
  const lines: string[] = [];
  for (const f of findings) {
    const level = f.severity === 'error' ? 'error' : f.severity === 'info' ? 'notice' : 'warning';
    const props = [`title=${escapeGhProp(`${f.category} ${f.id}`)}`];
    if (f.file) {
      props.push(`file=${escapeGhProp(f.file)}`);
      if (f.line && f.line > 0) props.push(`line=${f.line}`);
      if (f.column && f.column > 0) props.push(`col=${f.column}`);
    }
    const loc = f.selector ? ` [${f.selector}]` : '';
    const guideHint =
      f.guides.length > 0 ? ` (npx modern-web-guidance retrieve ${f.guides.join(',')})` : '';
    lines.push(`::${level} ${props.join(',')}::${escapeGhData(`${f.message}${loc} — ${f.fix}${guideHint}`)}`);
  }
  return lines.join('\n');
}

export function formatHumanReport(report: VerifyReport): string {
  const target = [report.url, report.targetDir].filter(Boolean).join(' + ') || 'workspace';
  const envBits: string[] = [];
  if (report.viewport) {
    envBits.push(`${report.viewport.width}x${report.viewport.height}${report.viewport.mobile ? ' mobile' : ''}`);
  }
  if (report.cpuThrottle) envBits.push(`${report.cpuThrottle}x CPU`);
  if (report.cls !== null) envBits.push(`CLS ${report.cls.toFixed(3)}`);
  if (report.lcpMs !== null) envBits.push(`LCP ${report.lcpMs}ms`);
  envBits.push(`${report.durationMs}ms`);

  const suppressed = report.suppressedCount > 0 ? ` (${report.suppressedCount} baseline suppressed)` : '';
  const status = report.passed ? 'PASS' : 'FAIL';
  const lines = [
    `modern-web-guidance verify: ${status} — ${target} [${envBits.join(', ')}]`,
    `${report.errorCount} error(s), ${report.warningCount} warning(s), ${report.infoCount} info${suppressed}`,
  ];

  for (const f of report.findings) {
    const loc = f.file
      ? `${f.file}:${f.line ?? 1}${f.column ? `:${f.column}` : ''}`
      : f.selector || f.url || '';
    lines.push(`  [${f.severity.toUpperCase()}][${f.category}] ${f.id}${loc ? ` (${loc})` : ''}: ${f.message}`);
    lines.push(`    Fix: ${f.fix}`);
  }

  if (report.guides.length > 0) {
    lines.push(`Guides: npx modern-web-guidance retrieve ${report.guides.join(',')}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function runVerifyingCli(argv: string[]): Promise<VerifyingCliResult> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        json: { type: 'boolean', default: false },
        github: { type: 'boolean', default: false },
        mobile: { type: 'boolean', default: false },
        'no-smoke': { type: 'boolean', default: false },
        'cpu-throttle': { type: 'string' },
        baseline: { type: 'string' },
        dir: { type: 'string' },
        chrome: { type: 'string' },
        timeout: { type: 'string' },
        'skill-version': { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, stderr: `Invalid arguments: ${msg}\n\n${VERIFY_USAGE}` };
  }

  if (parsed.values.help) {
    return { exitCode: 0, stdout: VERIFY_USAGE };
  }

  const positional = parsed.positionals[0];
  let url: string | undefined;
  let targetDir = typeof parsed.values.dir === 'string' ? path.resolve(parsed.values.dir) : undefined;

  if (positional) {
    if (/^https?:\/\//i.test(positional)) {
      url = positional;
    } else if (!targetDir && existsSync(path.resolve(positional))) {
      targetDir = path.resolve(positional);
    } else {
      return {
        exitCode: 1,
        stderr: `Target must be an http(s) URL or an existing local directory: ${positional}\n\n${VERIFY_USAGE}`,
      };
    }
  }

  if (!url && !targetDir) {
    return { exitCode: 1, stderr: `Missing <url> or --dir <path>.\n\n${VERIFY_USAGE}` };
  }
  if (targetDir && !existsSync(targetDir)) {
    return { exitCode: 1, stderr: `Directory does not exist: ${targetDir}\n` };
  }

  let cpuThrottle: number | undefined;
  if (typeof parsed.values['cpu-throttle'] === 'string') {
    const val = Number(parsed.values['cpu-throttle']);
    if (!Number.isFinite(val) || val < 1) {
      return { exitCode: 1, stderr: `Invalid --cpu-throttle value: ${parsed.values['cpu-throttle']} (expected number >= 1)\n` };
    }
    cpuThrottle = val;
  }

  let timeoutMs: number | undefined;
  if (typeof parsed.values.timeout === 'string') {
    const val = Number(parsed.values.timeout);
    if (!Number.isFinite(val) || val < 500) {
      return { exitCode: 1, stderr: `Invalid --timeout value: ${parsed.values.timeout} (expected ms >= 500)\n` };
    }
    timeoutMs = val;
  }

  try {
    const report = await runVerify({
      url,
      targetDir,
      mobile: Boolean(parsed.values.mobile),
      cpuThrottle,
      baselinePath: typeof parsed.values.baseline === 'string' ? path.resolve(parsed.values.baseline) : undefined,
      smokeProbe: !parsed.values['no-smoke'],
      chromePath: typeof parsed.values.chrome === 'string' ? parsed.values.chrome : undefined,
      timeoutMs,
    });

    const stdout = parsed.values.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : parsed.values.github
        ? `${formatGithubAnnotations(report.findings)}${report.findings.length > 0 ? '\n' : ''}`
        : formatHumanReport(report);

    return {
      exitCode: report.passed ? 0 : 1,
      stdout,
      data: report,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, stderr: `Verification failed: ${msg}\n` };
  }
}

export function writeVerifyingCliResult(result: VerifyingCliResult): number {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

function escapeGhData(val: string): string {
  return val.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeGhProp(val: string): string {
  return escapeGhData(val).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVerifyingCli(process.argv.slice(2))
    .then((res) => process.exit(writeVerifyingCliResult(res)))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
