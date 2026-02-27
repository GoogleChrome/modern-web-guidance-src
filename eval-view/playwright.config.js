import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: '*.spec.js',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts if we were doing it manually
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Ensure single worker for stable port usage
  reporter: 'list',
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
    command: 'PORT=11432 NO_OPEN=true USE_MOCK_RESULTS=true node server.js',
    url: 'http://localhost:11432',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
