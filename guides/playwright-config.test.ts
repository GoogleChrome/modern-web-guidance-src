import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Playwright Config', () => {
  it('loads without error', async () => {
    // Attempt to load the config file to ensure it doesn't throw ReferenceError
    // or other ESM related errors.
    const config = await import('./playwright.config.ts');
    assert.ok(config.default, 'Config should have a default export');
  });
});
