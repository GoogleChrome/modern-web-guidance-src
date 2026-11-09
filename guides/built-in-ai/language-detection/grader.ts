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

test.describe(`Language Detection Expectations: ${demoName}`, () => {
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

    await page.addInitScript(() => {
      window.__calls = [];
      window.__aiUsed = false;

      window.LanguageDetector = {
        availability: async () => {
          window.__calls.push('availability');
          return 'available';
        },
        create: async (_options: any) => {
          window.__calls.push('create');
          return {
            detect: async (_text: string) => {
              window.__calls.push('detect');
              return [{ detectedLanguage: 'en', confidence: 0.95 }];
            }
          };
        }
      };

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

    // Trigger potential interactions
    const detectButton = page.locator('button', { hasText: /detect/i });
    if (await detectButton.count() > 0) {
      const input = page.locator('textarea, input[type="text"]');
      if (await input.count() > 0) {
        await input.first().fill('Hallo und herzlich willkommen!');
      }
      await detectButton.click();
    }
  });

  test('The page uses the LanguageDetector API and does not access the deprecated window.ai.languageDetector API', async ({ page }) => {
    const aiUsed = await page.evaluate(() => window.__aiUsed);
    expect(aiUsed).toBe(false);
    const calls = await page.evaluate(() => window.__calls);
    expect(calls.some(c => c === 'availability' || c === 'create' || c === 'detect')).toBe(true);
  });

  test('The implementation checks API availability via LanguageDetector.availability()', async ({ page }) => {
    await page.waitForFunction(() => window.__calls.includes('availability'), null, { timeout: 3000 });
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('availability');
  });

  test('The implementation creates a detector with LanguageDetector.create() and calls detect() with the input text', async ({ page }) => {
    await page.waitForFunction(() => window.__calls.includes('detect'), null, { timeout: 3000 });
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('create');
    expect(calls).toContain('detect');
  });

  test('The page displays the detected language result', async ({ page }) => {
    await page.waitForFunction(() => window.__calls.includes('detect'), null, { timeout: 3000 });
    // The mock returns { detectedLanguage: 'en', confidence: 0.95 }; match whole words so
    // unrelated page text (e.g. the "Detect" button) can't satisfy the check.
    await expect(page.locator('body')).toContainText(/\bEnglish\b|\ben\b|\b95(?:\.0+)?\s*%|\b0\.95\b/i, { useInnerText: true, timeout: 3000 });
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
