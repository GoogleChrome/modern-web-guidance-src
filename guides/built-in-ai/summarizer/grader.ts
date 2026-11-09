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
  });

  test('The implementation uses `window.Summarizer` and does not use the deprecated `window.ai.summarizer` API surface.', async ({ page }) => {
    await expect.poll(async () => {
      const calls = await page.evaluate(() => (window as any).__summarizer_calls);
      return (calls.availability?.length ?? 0) > 0 || (calls.create?.length ?? 0) > 0 || calls.ai_summarizer_called;
    }).toBe(true);

    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    expect(calls.ai_summarizer_called).toBe(false);
  });

  test('The implementation calls `Summarizer.availability()` to check model availability before creating the summarizer.', async ({ page }) => {
    await expect.poll(async () => {
      const calls = await page.evaluate(() => (window as any).__summarizer_calls);
      return calls?.availability?.length ?? 0;
    }).toBeGreaterThan(0);
  });

  test('The same options are passed to both `Summarizer.availability()` and `Summarizer.create()`.', async ({ page }) => {
    await expect.poll(async () => {
      const calls = await page.evaluate(() => (window as any).__summarizer_calls);
      return (calls?.availability?.length ?? 0) > 0 && (calls?.create?.length ?? 0) > 0;
    }).toBe(true);

    const calls = await page.evaluate(() => (window as any).__summarizer_calls);
    const availabilityOptions = calls.availability[0][0];
    const createOptions = { ...calls.create[0] };
    delete createOptions.monitor; // monitor is only for create

    expect(availabilityOptions).toEqual(createOptions);
  });

  test("The `Summarizer` instance's `summarize()` or `summarizeStreaming()` method is called to generate a summary.", async ({ page }) => {
    await expect.poll(async () => {
      const calls = await page.evaluate(() => (window as any).__summarizer_calls);
      return (calls?.summarize?.length ?? 0) + (calls?.summarizeStreaming?.length ?? 0);
    }).toBeGreaterThan(0);
  });

  test('A monitor for download progress is implemented using the `downloadprogress` event.', async ({ page }) => {
    await expect.poll(async () => {
      const calls = await page.evaluate(() => (window as any).__summarizer_calls);
      return calls?.eventsAdded ?? [];
    }).toContain('downloadprogress');
  });
});
