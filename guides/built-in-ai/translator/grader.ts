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
test.describe(`Translator Expectations: ${demoName}`, () => {
  // Functional/Static assertions
  test('Source code should use the Translator API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('Translator');
  });

  test('Source code should not use the deprecated window.ai.translator API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('window.ai.translator');
  });

  test('Source code should check for API availability using availability()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('availability(');
  });

  test('Source code should specify sourceLanguage and targetLanguage options', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('sourceLanguage');
    expect(html).toContain('targetLanguage');
  });

  test('Source code should call translate() or translateStreaming()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('translate(') || html.includes('translateStreaming(')).toBe(true);
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

      // Mock window.Translator
      window.Translator = {
        availability: async (_options: any) => {
          window.__calls.push('availability');
          return 'available';
        },
        create: async (_options: any) => {
          window.__calls.push('create');
          return {
            translate: async (_input: string, _options?: any) => {
              window.__calls.push('translate');
              return 'El zorro marrón rápido salta sobre el perro perezoso.';
            },
            translateStreaming: (_input: string, _options?: any) => {
              window.__calls.push('translateStreaming');
              return new ReadableStream({
                start(controller) {
                  controller.enqueue('El zorro marrón rápido salta sobre el perro perezoso.');
                  controller.close();
                },
              });
            },
          };
        },
      };

      // Mock window.ai.translator to detect forbidden usage
      if (!window.ai) {
        window.ai = {};
      }
      Object.defineProperty(window.ai, 'translator', {
        get() {
          window.__aiUsed = true;
          return {
            create: async () => ({
              translate: async () => 'translation',
            }),
          };
        },
        configurable: true,
      });
    });

    await page.goto(demoUrl);

    // Trigger potential interactions (e.g., buttons in negative-demo.html)
    const translateButton = page.locator('button', { hasText: /translate/i });
    if (await translateButton.count() > 0) {
      const textarea = page.locator('textarea');
      if (await textarea.count() > 0) {
        await textarea.fill('The quick brown fox jumps over the lazy dog.');
      }
      await translateButton.click();
    }

    // Wait for any async script execution
    await page.waitForTimeout(500);
  });

  // Browser assertions
  test('Browser: Translator.availability() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('availability');
  });

  test('Browser: Translator.create() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('create');
  });

  test('Browser: translateStreaming() or translate() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls.includes('translateStreaming') || calls.includes('translate')).toBe(true);
  });

  test('Browser: The deprecated window.ai.translator API should not be accessed', async ({ page }) => {
    const aiUsed = await page.evaluate(() => window.__aiUsed);
    expect(aiUsed).toBe(false);
  });
});

declare global {
  interface Window {
    Translator: any;
    ai: any;
    __calls: string[];
    __aiUsed: boolean;
  }
}
