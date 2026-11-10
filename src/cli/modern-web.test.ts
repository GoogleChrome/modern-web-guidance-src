import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { USE_CASES } from '../rag/guides.ts';

const scriptPath = path.resolve(import.meta.dirname, './modern-web.ts');
const smallUngated = USE_CASES.find(
  (u) => !u.originTrials?.length && !u.volatileFeatures?.length && u.tokenCount < 1000
)?.id ?? 'accessible-generated-content';

describe('modern-web CLI', () => {
  const runCLI = (args: string[]) => {
    const result = spawnSync('node', [scriptPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', DISABLE_TELEMETRY: '1' }
    });
    return result;
  };

  it('prints usage when no arguments provided', () => {
    const { stdout } = runCLI([]);
    assert.ok(stdout.includes('Usage: modern-web-guidance <command> [args]'));
    assert.ok(stdout.includes('legacy-scan [path] [options]'));
  });

  it('lists use cases in compact format with id and description', () => {
    const { stdout, status } = runCLI(['list']);
    assert.strictEqual(status, 0);

    const trimmed = stdout.trim();
    const catalog = JSON.parse(trimmed);
    assert.ok(Array.isArray(catalog), 'Output should be a JSON array');
    assert.ok(catalog.length > 100, 'Catalog should contain all documented guidelines');

    // Check compact structure (only id and description, no category or extras)
    const firstItem = catalog[0];
    assert.ok(firstItem.id, 'Item should have an id');
    assert.ok(firstItem.description, 'Item should have a description');
    assert.deepStrictEqual(Object.keys(firstItem).sort(), ['description', 'id']);

    // Check one line per item formatting
    assert.strictEqual(trimmed.split('\n').length, catalog.length, 'Each item should be on its own line');
    assert.ok(trimmed.includes('accessible-error-announcement'));
  });

  it('retrieves multiple guides separated by commas, spaces, or escaped quotes and deduplicates IDs', () => {
    const commaRes = runCLI(['retrieve', 'deprioritize-background-fetches,break-up-long-tasks']);
    assert.strictEqual(commaRes.status, 0);
    assert.ok(commaRes.stdout.includes('--- Guide for deprioritize-background-fetches ---'));
    assert.ok(commaRes.stdout.includes('--- Guide for break-up-long-tasks ---'));

    const spaceArgsRes = runCLI(['retrieve', 'deprioritize-background-fetches', 'break-up-long-tasks']);
    assert.strictEqual(spaceArgsRes.status, 0);
    assert.strictEqual(spaceArgsRes.stdout, commaRes.stdout);

    const spaceQuotedRes = runCLI(['retrieve', 'deprioritize-background-fetches break-up-long-tasks']);
    assert.strictEqual(spaceQuotedRes.status, 0);
    assert.strictEqual(spaceQuotedRes.stdout, commaRes.stdout);

    const escapedQuotesAndDupesRes = runCLI(['retrieve', '\\"deprioritize-background-fetches\\"', 'deprioritize-background-fetches']);
    assert.strictEqual(escapedQuotesAndDupesRes.status, 0);
    const occurrences = escapedQuotesAndDupesRes.stdout.split('--- Guide for deprioritize-background-fetches ---').length - 1;
    assert.strictEqual(occurrences, 1, 'Duplicate guide IDs should only be printed once');
  });

  it('automatically saves large (> 9.5 KB) output to a temporary UTF-8 file while keeping <= 9.5 KB output inline', () => {
    const smallRes = runCLI(['retrieve', smallUngated]);
    assert.strictEqual(smallRes.status, 0);
    assert.ok(smallRes.stdout.includes(`--- Guide for ${smallUngated} ---`), 'Small guide should print inline to stdout');

    const res = runCLI(['retrieve', `${smallUngated},css`]);
    assert.strictEqual(res.status, 0);
    const match = res.stdout.trim().match(/^Output \([\d.]+ KB, \d+ lines\) saved to (\S+) to prevent CLI stdout truncation\./);
    assert.ok(match, `Expected saved file path message, got: ${res.stdout}`);

    const savedPath = match[1];
    try {
      assert.ok(fs.existsSync(savedPath), `Saved file should exist at ${savedPath}`);
      const content = fs.readFileSync(savedPath, 'utf8');
      const firstIdx = content.indexOf(`--- Guide for ${smallUngated} ---`);
      const secondIdx = content.indexOf('--- Guide for css ---');
      assert.ok(firstIdx !== -1 && secondIdx !== -1, 'Both guides should be present in saved file');
      assert.ok(firstIdx < secondIdx, 'Guides should appear in the exact order requested');
    } finally {
      fs.rmSync(savedPath, { force: true });
    }
  });

  it('writes full guide markdown directly when stdout is redirected to a file (> file.md)', () => {
    const redirectedPath = path.join(os.tmpdir(), `mwg-redirect-test-${process.pid}-${Date.now()}.md`);
    const fd = fs.openSync(redirectedPath, 'w');
    try {
      const result = spawnSync('node', [scriptPath, 'retrieve', `css,${smallUngated}`], {
        stdio: ['ignore', fd, 'pipe'],
        env: { ...process.env, NO_COLOR: '1', DISABLE_TELEMETRY: '1' }
      });
      assert.strictEqual(result.status, 0);
    } finally {
      fs.closeSync(fd);
    }

    try {
      const content = fs.readFileSync(redirectedPath, 'utf8');
      assert.ok(content.includes(`--- Guide for ${smallUngated} ---`));
      assert.ok(content.includes('--- Guide for css ---'));
      assert.ok(!content.includes('saved to '), 'Redirected file should contain raw guide markdown, not a file pointer');
    } finally {
      fs.rmSync(redirectedPath, { force: true });
    }
  });

  it('handles legacy-scan with leading and trailing --skill-version without shifting positional arguments', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-analyze-test-'));
    try {
      // Leading --skill-version
      const leadingRes = runCLI(['--skill-version', '2026_01_01-test', 'legacy-scan', tempDir, '--json']);
      assert.strictEqual(leadingRes.status, 0);
      const leadingData = JSON.parse(leadingRes.stdout);
      assert.strictEqual(leadingData.totalFindings, 0);
      assert.strictEqual(leadingData.targetDir, tempDir);
      assert.match(leadingData.note, /No legacy patterns found across \d+ guides \(\d+ rules; ~20% of the guidance corpus\)/);

      // Trailing --skill-version
      const trailingRes = runCLI(['legacy-scan', tempDir, '--json', '--skill-version', '2026_01_01-test']);
      assert.strictEqual(trailingRes.status, 0);
      const trailingData = JSON.parse(trailingRes.stdout);
      assert.strictEqual(trailingData.totalFindings, 0);
      assert.strictEqual(trailingData.targetDir, tempDir);
      assert.match(trailingData.note, /No legacy patterns found across \d+ guides \(\d+ rules; ~20% of the guidance corpus\)/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('forwards --help to legacy-scan when --help appears before command', () => {
    const res1 = runCLI(['--help', 'legacy-scan']);
    assert.strictEqual(res1.status, 0);
    assert.ok(res1.stdout.includes('Usage: modern-web-guidance legacy-scan'));

    const res2 = runCLI(['--help', 'analyze']);
    assert.strictEqual(res2.status, 0);
    assert.ok(res2.stdout.includes('Usage: modern-web-guidance legacy-scan'));
  });

  it('emits skill update warning when running legacy-scan with outdated --skill-version', () => {
    const versionPath = path.resolve(import.meta.dirname, 'skill-version.txt');
    fs.writeFileSync(versionPath, '2026_05_16-latest12\n');
    try {
      const res = runCLI(['--skill-version', '2025_01_01-oldsha', 'legacy-scan', '--help']);
      assert.strictEqual(res.status, 0);
      assert.ok(res.stdout.includes('Usage: modern-web-guidance legacy-scan'));
      assert.ok(res.stderr.includes('Warning: a new SKILL.md is available'));
      assert.ok(res.stderr.includes('PROBLEM DETECTED: The modern-web-guidance skill is very out-of-date'));
    } finally {
      fs.rmSync(versionPath, { force: true });
    }
  });

  it('exits with code 1 when legacy-scan is called with unknown --guide ID', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-analyze-test-'));
    try {
      const resJson = runCLI(['legacy-scan', tempDir, '--guide', 'nonexistent-guide-id', '--json']);
      assert.strictEqual(resJson.status, 1);
      const data = JSON.parse(resJson.stdout);
      assert.strictEqual(data.totalFindings, 0);
      assert.match(data.error ?? '', /Unknown or unsupported analyzer guide ID: nonexistent-guide-id/);

      const resHuman = runCLI(['legacy-scan', tempDir, '--guide', 'nonexistent-guide-id']);
      assert.strictEqual(resHuman.status, 1);
      assert.match(resHuman.stderr, /Unknown or unsupported analyzer guide ID: nonexistent-guide-id/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('only logs to modern-web.log when analyze or legacy-scan exits with code 0 and result.data is present', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-analyze-log-test-'));
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-analyze-logdir-'));
    try {
      const runCLIWithLogging = (args: string[]) => {
        return spawnSync('node', [scriptPath, ...args], {
          encoding: 'utf8',
          env: {
            ...process.env,
            NO_COLOR: '1',
            DISABLE_TELEMETRY: '1',
            ENABLE_FILE_LOGGING: 'true',
            MODERN_WEB_LOG_DIR: logDir,
          },
        });
      };

      // 1. Failing analyze call (nonexistent path) -> exit code 1, should NOT log to modern-web.log
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      const failRes = runCLIWithLogging(['analyze', nonExistentDir, '--json']);
      assert.strictEqual(failRes.status, 1);
      const logPath = path.join(logDir, 'modern-web.log');
      assert.strictEqual(fs.existsSync(logPath), false, 'Failed analyze run must not create modern-web.log');

      // 2. Failing analyze call (unknown guide id) -> exit code 1, should NOT log to modern-web.log
      const failGuideRes = runCLIWithLogging(['analyze', tempDir, '--guide', 'unknown-id', '--json']);
      assert.strictEqual(failGuideRes.status, 1);
      assert.strictEqual(fs.existsSync(logPath), false, 'Failed analyze run with unknown guide must not log');

      // 3. Successful analyze call -> exit code 0, SHOULD log to modern-web.log
      const okRes = runCLIWithLogging(['analyze', tempDir, '--json']);
      assert.strictEqual(okRes.status, 0);
      assert.strictEqual(fs.existsSync(logPath), true, 'Successful analyze run should create modern-web.log');
      const logContent = fs.readFileSync(logPath, 'utf8');
      const parsedLog = JSON.parse(logContent.trim());
      assert.strictEqual(parsedLog.tool, 'analyze');
      assert.ok(Array.isArray(parsedLog.result));

      // 4. Successful legacy-scan call -> exit code 0, SHOULD also log tool: 'analyze' to modern-web.log
      fs.rmSync(logPath, { force: true });
      const okLegacyScanRes = runCLIWithLogging(['legacy-scan', tempDir, '--json']);
      assert.strictEqual(okLegacyScanRes.status, 0);
      assert.strictEqual(fs.existsSync(logPath), true, 'Successful legacy-scan run should create modern-web.log');
      const legacyScanLog = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());
      assert.strictEqual(legacyScanLog.tool, 'analyze');
      assert.ok(Array.isArray(legacyScanLog.result));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.rmSync(logDir, { recursive: true, force: true });
    }
  });

  it('passes -y to npx when uninstalling skills', () => {
    const tempBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-npx-test-'));
    const logFile = path.join(tempBinDir, 'npx-args.json');
    const npxShim = path.join(tempBinDir, 'npx');
    fs.writeFileSync(
      npxShim,
      `#!/bin/sh\nnode -e 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))' "${logFile}" "$@"\n`,
      { mode: 0o755 }
    );

    try {
      const result = spawnSync('node', [scriptPath, 'uninstall'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tempBinDir}:${process.env.PATH}`,
          NO_COLOR: '1',
          DISABLE_TELEMETRY: '1',
        },
      });

      assert.strictEqual(result.status, 0);
      assert.ok(fs.existsSync(logFile), 'Dummy npx should have recorded arguments');
      const args = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      assert.deepStrictEqual(args.slice(0, 3), ['-y', 'skills', 'remove']);
    } finally {
      fs.rmSync(tempBinDir, { recursive: true, force: true });
    }
  });
});
