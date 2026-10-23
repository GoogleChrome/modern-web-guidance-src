import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { outDir, guidesDir } from '../core/paths.ts';

export default defineConfig({
  timeout: 5000,
  expect: { timeout: 2000 },
  // Forces Playwright to always search relative to the guides directory,
  // regardless of where you run it from (e.g., when run from within a specific results folder).
  testDir: guidesDir,
  testMatch: '**/grader.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(outDir, 'test-results'),
  use: {
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}), // Force usage of system Chrome on macOS to avoid EPERM
      },
    },
  ],
});
