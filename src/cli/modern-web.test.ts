import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dirname, './modern-web.ts');

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
    assert.ok(stdout.includes('Usage: modern-web <command> [args]'));
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
    const smallRes = runCLI(['retrieve', 'accessible-generated-content']);
    assert.strictEqual(smallRes.status, 0);
    assert.ok(smallRes.stdout.includes('--- Guide for accessible-generated-content ---'), 'Small guide should print inline to stdout');

    const res = runCLI(['retrieve', 'accessible-generated-content,css']);
    assert.strictEqual(res.status, 0);
    const match = res.stdout.trim().match(/^Output \([\d.]+ KB, \d+ lines\) saved to (\S+) to prevent CLI stdout truncation\./);
    assert.ok(match, `Expected saved file path message, got: ${res.stdout}`);

    const savedPath = match[1];
    try {
      assert.ok(fs.existsSync(savedPath), `Saved file should exist at ${savedPath}`);
      const content = fs.readFileSync(savedPath, 'utf8');
      const firstIdx = content.indexOf('--- Guide for accessible-generated-content ---');
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
      const result = spawnSync('node', [scriptPath, 'retrieve', 'css,accessible-generated-content'], {
        stdio: ['ignore', fd, 'pipe'],
        env: { ...process.env, NO_COLOR: '1', DISABLE_TELEMETRY: '1' }
      });
      assert.strictEqual(result.status, 0);
    } finally {
      fs.closeSync(fd);
    }

    try {
      const content = fs.readFileSync(redirectedPath, 'utf8');
      assert.ok(content.includes('--- Guide for accessible-generated-content ---'));
      assert.ok(content.includes('--- Guide for css ---'));
      assert.ok(!content.includes('saved to '), 'Redirected file should contain raw guide markdown, not a file pointer');
    } finally {
      fs.rmSync(redirectedPath, { force: true });
    }
  });

  it('handles analyze with leading and trailing --skill-version without shifting positional arguments', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-analyze-test-'));
    try {
      // Leading --skill-version
      const leadingRes = runCLI(['--skill-version', '2026_01_01-test', 'analyze', tempDir, '--json']);
      assert.strictEqual(leadingRes.status, 0);
      const leadingData = JSON.parse(leadingRes.stdout);
      assert.strictEqual(leadingData.totalFindings, 0);
      assert.strictEqual(leadingData.targetDir, tempDir);
      assert.match(leadingData.note, /\d+ supported analyzer rules/);

      // Trailing --skill-version
      const trailingRes = runCLI(['analyze', tempDir, '--json', '--skill-version', '2026_01_01-test']);
      assert.strictEqual(trailingRes.status, 0);
      const trailingData = JSON.parse(trailingRes.stdout);
      assert.strictEqual(trailingData.totalFindings, 0);
      assert.strictEqual(trailingData.targetDir, tempDir);
      assert.match(trailingData.note, /\d+ supported analyzer rules/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('forwards --help to analyze when --help appears before analyze', () => {
    const res = runCLI(['--help', 'analyze']);
    assert.strictEqual(res.status, 0);
    assert.ok(res.stdout.includes('Usage: modern-web-guidance analyze'));
  });

  it('emits skill update warning when running analyze with outdated --skill-version', () => {
    const versionPath = path.resolve(import.meta.dirname, 'skill-version.txt');
    fs.writeFileSync(versionPath, '2026_05_16-latest12\n');
    try {
      const res = runCLI(['--skill-version', '2025_01_01-oldsha', 'analyze', '--help']);
      assert.strictEqual(res.status, 0);
      assert.ok(res.stdout.includes('Usage: modern-web-guidance analyze'));
      assert.ok(res.stderr.includes('Warning: a new SKILL.md is available'));
      assert.ok(res.stderr.includes('PROBLEM DETECTED: The modern-web-guidance skill is very out-of-date'));
    } finally {
      fs.rmSync(versionPath, { force: true });
    }
  });
});
