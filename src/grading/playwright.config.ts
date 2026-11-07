import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { outDir, guidesDir } from '../core/paths.ts';

export default defineConfig({
  timeout: 5000,
  expect: { timeout: 2000 },
  // Forces Playwright to always search relative to the guides directory,
  // regardless of where you run it from (e.g., when run from within a specific results folder).
  testDir: process.env.PLAYWRIGHT_TEST_DIR || guidesDir,
  testMatch: '**/grader.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  // Disable Playwright's CI git-info plugin: in PR workflows it runs `git fetch --depth=1`
  // inside configDir, converting full clones into shallow ones and severing tag history.
  captureGitInfo: { commit: false, diff: false },
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
