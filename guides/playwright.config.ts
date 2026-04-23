import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

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
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
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
