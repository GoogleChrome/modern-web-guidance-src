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

    it('returns false when GD_SUITE_CONFIG is unset', () => {
      delete process.env.GD_SUITE_CONFIG;
      try {
        assert.strictEqual(shouldIncludeTrace(), false);
      } finally {
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
  });
});
