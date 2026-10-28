import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
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
});
