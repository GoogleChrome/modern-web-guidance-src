import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

export default defineConfig({
  testDir: '.',
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
