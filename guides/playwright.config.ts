import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

function shouldIncludeTrace(): boolean {
  const configEnv = process.env.GD_SUITE_CONFIG;
  if (!configEnv) return false;
  try {
    let content = configEnv;
    if (!configEnv.trim().startsWith('{') && fs.existsSync(configEnv)) {
      content = fs.readFileSync(configEnv, 'utf8');
    }
    return !!JSON.parse(content).includeTrace;
  } catch {
    return false;
  }
}

const includeTrace = shouldIncludeTrace();

export default defineConfig({
  timeout: 5000,
  expect: { timeout: 2000 },
  // Forces Playwright to always search relative to this config file (the guides directory),
  // regardless of where you run it from (e.g., when run from within a specific results folder).
  testDir: import.meta.dirname,
  testMatch: '**/grader.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(import.meta.dirname, 'test-results'),
  use: {
    trace: includeTrace ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Force usage of system Chrome to avoid EPERM on macOS
      },
    },
  ],
});
