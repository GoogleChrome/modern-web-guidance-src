import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Summarizer Expectations: ${demoName}`, () => {
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

    // Inject mocks before the page loads
    await page.addInitScript(() => {
      (window as any).__summarizer_calls = {
        availability: [],
        create: [],
        summarize: [],
        summarizeStreaming: [],
        monitorCalls: [],
        eventsAdded: [],
        ai_summarizer_called: false,
      };

      const mockInstance = {
        summarize: async (...args: any[]) => {
          (window as any).__summarizer_calls.summarize.push(args);
          return 'mock summary';
        },
        summarizeStreaming: function (...args: any[]) {
          (window as any).__summarizer_calls.summarizeStreaming.push(args);
          return (async function* () {
            yield 'mock ';
            yield 'streamed ';
            yield 'summary';
          })();
        }
      };

      (window as any).Summarizer = {
        availability: async (...args: any[]) => {
          (window as any).__summarizer_calls.availability.push(args);
          return 'available';
        },
        create: async (options: any) => {
          (window as any).__summarizer_calls.create.push(options);
          if (options && typeof options.monitor === 'function') {
            const monitor = {
              addEventListener: (type: string, _listener: any) => {
                (window as any).__summarizer_calls.eventsAdded.push(type);
              }
            };
            options.monitor(monitor);
          }
          return mockInstance;
        }
      };

      // Mock window.ai.summarizer to track if it's used (which is forbidden)
      if (!(window as any).ai) (window as any).ai = {};
      (window as any).ai.summarizer = {
        create: async () => {
          (window as any).__summarizer_calls.ai_summarizer_called = true;
          // Return a different mock instance so calls to it don't count towards window.Summarizer
          return {
            summarize: async () => 'wrong api summary',
            summarizeStreaming: (async function* () { yield 'wrong api summary'; })()
          };
        }
      };
    });

    await page.goto(demoUrl);
    // Trigger summarize button if it exists (for negative-demo.html)
    const runButton = page.locator('button#run, button:has-text("Summarize")');
    if (await runButton.count() > 0) {
      await runButton.click();
    }
    // Give it a bit of time to execute scripts
    await page.waitForTimeout(500);
  });

  test('Summarizer API should be available on window.Summarizer, not window.ai.summarizer', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    expect(calls.ai_summarizer_called).toBe(false);
    // Also check if Summarizer was at least attempted to be used if we are in demo.html
    // but the main requirement is that ai.summarizer is NOT used.
  });

  test('Summarizer.availability() should be called', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    expect(calls.availability.length).toBeGreaterThan(0);
  });

  test('The same options should be passed to both Summarizer.availability() and Summarizer.create()', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    expect(calls.availability.length).toBeGreaterThan(0);
    expect(calls.create.length).toBeGreaterThan(0);

    const availabilityOptions = calls.availability[0][0];
    const createOptions = { ...calls.create[0] };
    delete createOptions.monitor; // monitor is only for create

    expect(availabilityOptions).toEqual(createOptions);
  });

  test('Source code should call summarize() or summarizeStreaming() on the Summarizer instance', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    const totalCalls = calls.summarize.length + calls.summarizeStreaming.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  test('A monitor for download progress should be implemented using the downloadprogress event', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    expect(calls.eventsAdded).toContain('downloadprogress');
  });
});
