import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shouldIncludeTrace } from './playwright.config.ts';

describe('Playwright Config', () => {
  it('loads without error', async () => {
    // Attempt to load the config file to ensure it doesn't throw ReferenceError
    // or other ESM related errors.
    const config = await import('./playwright.config.ts');
    assert.ok(config.default, 'Config should have a default export');
  });

  describe('shouldIncludeTrace', () => {
    const originalEnv = process.env.GD_SUITE_CONFIG;

    it('returns false when GD_SUITE_CONFIG is unset and no config up tree', () => {
      delete process.env.GD_SUITE_CONFIG;
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-test-none-'));
      try {
        assert.strictEqual(shouldIncludeTrace(tempDir), false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (originalEnv !== undefined) process.env.GD_SUITE_CONFIG = originalEnv;
      }
    });

    it('returns true when GD_SUITE_CONFIG is json string with includeTrace: true', () => {
      process.env.GD_SUITE_CONFIG = JSON.stringify({ includeTrace: true });
      try {
        assert.strictEqual(shouldIncludeTrace(), true);
      } finally {
        if (originalEnv !== undefined) {
          process.env.GD_SUITE_CONFIG = originalEnv;
        } else {
          delete process.env.GD_SUITE_CONFIG;
        }
      }
    });

    it('returns false when GD_SUITE_CONFIG is json string with includeTrace: false', () => {
      process.env.GD_SUITE_CONFIG = JSON.stringify({ includeTrace: false });
      try {
        assert.strictEqual(shouldIncludeTrace(), false);
      } finally {
        if (originalEnv !== undefined) {
          process.env.GD_SUITE_CONFIG = originalEnv;
        } else {
          delete process.env.GD_SUITE_CONFIG;
        }
      }
    });

    it('reads from file path in GD_SUITE_CONFIG', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-test-file-'));
      const configFile = path.join(tempDir, 'suite_config.json');
      fs.writeFileSync(configFile, JSON.stringify({ includeTrace: true }));
      process.env.GD_SUITE_CONFIG = configFile;
      try {
        assert.strictEqual(shouldIncludeTrace(), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (originalEnv !== undefined) {
          process.env.GD_SUITE_CONFIG = originalEnv;
        } else {
          delete process.env.GD_SUITE_CONFIG;
        }
      }
    });

    it('walks up directory tree to locate suite_config.json when GD_SUITE_CONFIG is unset', () => {
      delete process.env.GD_SUITE_CONFIG;
      const rootTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-test-tree-'));
      const nestedDir = path.join(rootTemp, '1', 'my-guide', 'guided');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(rootTemp, 'suite_config.json'), JSON.stringify({ includeTrace: true }));

      try {
        assert.strictEqual(shouldIncludeTrace(nestedDir), true);
      } finally {
        fs.rmSync(rootTemp, { recursive: true, force: true });
        if (originalEnv !== undefined) process.env.GD_SUITE_CONFIG = originalEnv;
      }
    });
  });
});
