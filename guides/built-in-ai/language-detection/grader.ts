import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Tests
test.describe(`Language Detection Expectations: ${demoName}`, () => {
  // Functional/Static assertions
  test('Source code should use the LanguageDetector API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('LanguageDetector');
  });

  test('Source code should not use the deprecated window.ai.languageDetector API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('window.ai.languageDetector');
  });

  test('Source code should check for API availability using availability()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('availability()');
  });

  test('Source code should handle detection results as objects with a detectedLanguage property', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('.detectedLanguage');
  });

  test('Source code should handle detection results as objects with a confidence property', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('.confidence');
  });

  test('Source code should implement a monitor for download progress', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('downloadprogress');
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // Inject mocks and tracking
    await page.addInitScript(() => {
      window.__calls = [];
      window.__aiUsed = false;

      // Mock window.LanguageDetector
      window.LanguageDetector = {
        availability: async () => {
          window.__calls.push('availability');
          return 'available';
        },
        create: async (_options: any) => {
          window.__calls.push('create');
          // Basic validation of options if needed, but we just track the call
          return {
            detect: async (_text: string) => {
              window.__calls.push('detect');
              return [{ detectedLanguage: 'en', confidence: 0.95 }];
            }
          };
        }
      };

      // Mock window.ai.languageDetector to detect forbidden usage
      if (!window.ai) {
        window.ai = {};
      }
      Object.defineProperty(window.ai, 'languageDetector', {
        get() {
          window.__aiUsed = true;
          return {
            create: async () => ({
              detect: async () => 'en'
            })
          };
        },
        configurable: true
      });
    });

    await page.goto(demoUrl);

    // Trigger potential interactions (e.g., buttons in negative-demo.html)
    const detectButton = page.locator('button', { hasText: /detect/i });
    if (await detectButton.count() > 0) {
      const input = page.locator('textarea, input[type="text"]');
      if (await input.count() > 0) {
        await input.first().fill('Hallo und herzlich willkommen!');
      }
      await detectButton.click();
    }

    // Wait for any async script execution
    await page.waitForTimeout(500);
  });

  // Browser assertions
  test('Browser: LanguageDetector.availability() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('availability');
  });

  test('Browser: LanguageDetector.create() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('create');
  });

  test('Browser: LanguageDetector.detect() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('detect');
  });

  test('Browser: The deprecated window.ai.languageDetector API should not be accessed', async ({ page }) => {
    const aiUsed = await page.evaluate(() => window.__aiUsed);
    expect(aiUsed).toBe(false);
  });
});

declare global {
  interface Window {
    LanguageDetector: any;
    ai: any;
    __calls: string[];
    __aiUsed: boolean;
  }
}
