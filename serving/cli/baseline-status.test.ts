import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dirname, './baseline-status.ts');

describe('baseline-status CLI', () => {
  const runCLI = (args: string[]) => {
    const result = spawnSync('node', ['--experimental-strip-types', scriptPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' } // Ensure no colors in tests
    });
    return result;
  };

  it('prints usage when no arguments provided', () => {
    const { stdout } = runCLI([]);
    assert.ok(stdout.includes('Usage: pnpm baselinestatus'));
  });

  it('filters by query and outputs markdown table', () => {
    const { stdout } = runCLI(['overflow']);
    assert.ok(stdout.includes('| web-feature-id'));
    assert.ok(stdout.includes('| overflow '));
    assert.ok(stdout.includes('| overflow-clip '));
  });

  it('outputs JSON when --json flag is provided', () => {
    const { stdout } = runCLI(['overflow', '--json']);
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    assert.ok('featureId' in data[0]);
    assert.ok('baseline' in data[0]);
  });

  it('outputs empty array for no matches in JSON mode', () => {
    const { stdout } = runCLI(['nonexistentfeaturexyz', '--json']);
    assert.strictEqual(stdout.trim(), '[]');
  });

  it('omits Safari iOS column when versions match', () => {
    const { stdout } = runCLI(['overflow-clip']);
    assert.ok(stdout.includes('Safari'));
    assert.ok(!stdout.includes('Safari iOS'));
  });

  it('includes Safari iOS column when versions differ', () => {
    const { stdout } = runCLI(['async-clipboard']);
    assert.ok(stdout.includes('Safari'));
    assert.ok(stdout.includes('Safari iOS'));
  });
});

