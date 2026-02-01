import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Eval View Dashboard', () => {
  let serverProcess;
  const PORT = 8081;

  test.beforeAll(async () => {
    // Start the server
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'inherit',
    });

    // Wait for server to be ready
    await new Promise((resolve) => {
      const checkServer = async () => {
        try {
          const res = await fetch(`http://localhost:${PORT}`);
          if (res.ok) resolve();
          else setTimeout(checkServer, 100);
        } catch {
          setTimeout(checkServer, 100);
        }
      };
      checkServer();
    });
  });

  test.afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  test('should load the dashboard and show expected content', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}`);

    // Check title
    await expect(page.locator('.landing-title')).toContainText('Results');

    // Check tabs exist
    await expect(page.locator('.tab-button[data-tab="overview"]')).toBeVisible();
    await expect(page.locator('.tab-button[data-tab="explorer"]')).toBeVisible();
    await expect(page.locator('.tab-button[data-tab="trends"]')).toBeVisible();

    // Check overview content
    await expect(page.locator('#latest-guided-metric')).toBeVisible();
    await expect(page.locator('#latest-unguided-metric')).toBeVisible();
  });

  test('should navigate to explorer tab', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}`);
    await page.click('.tab-button[data-tab="explorer"]');
    
    await expect(page.locator('#explorer-tab')).toHaveClass(/active/);
    await expect(page.locator('.explorer-sidebar')).toBeVisible();
  });
});
