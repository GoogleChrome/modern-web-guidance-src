import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

export default defineConfig({
  timeout: 10000,
  expect: { timeout: 3000 },
  // Forces Playwright to always search relative to this config file (the guides directory),
  // regardless of where you run it from (e.g., when run from within a specific results folder).
  testDir: import.meta.dirname,
  testMatch: '**/grader.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'playwright-results'),
  use: {
    trace: 'off',
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
