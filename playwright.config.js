import { defineConfig, devices } from '@playwright/test';
import { rootDir } from '../core/paths.ts';

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: '*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : '50%',
  reporter: 'list',
  captureGitInfo: { commit: false, diff: false },
  use: {
    baseURL: 'http://localhost:11432',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'PORT=11432 NO_OPEN=true USE_MOCK_RESULTS=true node src/dashboard/server.js --local',
    cwd: rootDir,
    url: 'http://localhost:11432',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
