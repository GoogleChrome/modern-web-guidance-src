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
test.describe(`Summarizer Expectations: ${demoName}`, () => {
  // Functional/Static assertions
  test('Source code should use the Summarizer API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('Summarizer');
  });

  test('Source code should not use the deprecated window.ai.summarizer API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('window.ai.summarizer');
  });

  test('Source code should check for API availability using availability()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('availability()');
  });

  test('Source code should call summarize() or summarizeStreaming()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('summarize(') || html.includes('summarizeStreaming(')).toBe(true);
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

      // Mock window.Summarizer
      window.Summarizer = {
        availability: async (_options?: any) => {
          window.__calls.push('availability');
          return 'available';
        },
        create: async (_options?: any) => {
          window.__calls.push('create');
          return {
            summarize: async (_input: string, _options?: any) => {
              window.__calls.push('summarize');
              return 'A concise summary of the provided text.';
            },
            summarizeStreaming: (_input: string, _options?: any) => {
              window.__calls.push('summarizeStreaming');
              return new ReadableStream({
                start(controller) {
                  controller.enqueue('A concise summary.');
                  controller.close();
                },
              });
            },
          };
        },
      };

      // Mock window.ai.summarizer to detect forbidden usage
      if (!window.ai) {
        window.ai = {};
      }
      Object.defineProperty(window.ai, 'summarizer', {
        get() {
          window.__aiUsed = true;
          return {
            create: async () => ({
              summarize: async () => 'summary',
            }),
          };
        },
        configurable: true,
      });
    });

    await page.goto(demoUrl);

    // Trigger potential interactions (e.g., buttons in negative-demo.html)
    const summarizeButton = page.locator('button', { hasText: /summarize/i });
    if (await summarizeButton.count() > 0) {
      await summarizeButton.fill?.('Some text to summarize').catch(() => {});
      const textarea = page.locator('textarea');
      if (await textarea.count() > 0) {
        await textarea.fill('Some text to summarize');
      }
      await summarizeButton.click();
    }

    // Wait for any async script execution
    await page.waitForTimeout(500);
  });

  // Browser assertions
  test('Browser: Summarizer.availability() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('availability');
  });

  test('Browser: Summarizer.create() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls).toContain('create');
  });

  test('Browser: summarizeStreaming() or summarize() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => window.__calls);
    expect(calls.includes('summarizeStreaming') || calls.includes('summarize')).toBe(true);
  });

  test('Browser: The deprecated window.ai.summarizer API should not be accessed', async ({ page }) => {
    const aiUsed = await page.evaluate(() => window.__aiUsed);
    expect(aiUsed).toBe(false);
  });
});

declare global {
  interface Window {
    Summarizer: any;
    ai: any;
    __calls: string[];
    __aiUsed: boolean;
  }
}
