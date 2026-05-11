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

declare global {
  interface Window {
    __INTERACTIONS: {
      translatorAvailabilityCalled: boolean;
      translatorAvailabilityOptions: any;
      translatorCreateCalled: boolean;
      translatorCreateOptions: any;
      translatorInstanceMethodCalled: boolean;
      monitorProvided: boolean;
      downloadProgressListened: boolean;
      aiTranslatorAccessed: boolean;
    };
    Translator: any;
    ai: any;
  }
}

test.describe(`Translator Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Route local files
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // Inject mocks
    await page.addInitScript(() => {
      window.__INTERACTIONS = {
        translatorAvailabilityCalled: false,
        translatorAvailabilityOptions: null,
        translatorCreateCalled: false,
        translatorCreateOptions: null,
        translatorInstanceMethodCalled: false,
        monitorProvided: false,
        downloadProgressListened: false,
        aiTranslatorAccessed: false,
      };

      class MockTranslatorInstance {
        async translate() {
          window.__INTERACTIONS.translatorInstanceMethodCalled = true;
          return "mock translation";
        }
        async *translateStreaming() {
          window.__INTERACTIONS.translatorInstanceMethodCalled = true;
          yield "mock ";
          yield "translation";
        }
      }

      window.Translator = {
        async availability(options: any) {
          window.__INTERACTIONS.translatorAvailabilityCalled = true;
          window.__INTERACTIONS.translatorAvailabilityOptions = options;
          return 'available';
        },
        async create(options: any) {
          window.__INTERACTIONS.translatorCreateCalled = true;
          window.__INTERACTIONS.translatorCreateOptions = options;
          if (options && typeof options.monitor === 'function') {
            window.__INTERACTIONS.monitorProvided = true;
            const monitor = {
              addEventListener: (type: string, _listener: any) => {
                if (type === 'downloadprogress') {
                  window.__INTERACTIONS.downloadProgressListened = true;
                }
              }
            };
            try {
              options.monitor(monitor);
            } catch (e) {
              // Ignore errors in monitor callback
            }
          }
          return new MockTranslatorInstance();
        }
      };

      // Define window.ai to detect incorrect usage
      Object.defineProperty(window, 'ai', {
        get: () => {
          window.__INTERACTIONS.aiTranslatorAccessed = true;
          return {
            translator: {
              create: async () => {
                return {
                  translate: async () => "wrong translation",
                  translateStreaming: async function* () { yield "wrong"; }
                };
              }
            }
          };
        },
        configurable: true,
        enumerable: true
      });
    });

    await page.goto(demoUrl);
    
    // Give it a moment for initial scripts
    await page.waitForTimeout(500);

    // Try to trigger translation
    try {
      // Fill input if it's a textarea or has id input
      const input = await page.$('#input, textarea');
      if (input) {
        await input.fill('The quick brown fox jumps over the lazy dog.');
      }
      
      // Click translate button
      const translateBtn = await page.$('button[type="submit"], button#run, button[class*="translate"], button[data-translate], button:has-text("Translate"), button:has-text("Traducir")');
      if (translateBtn) {
        await translateBtn.click();
        // Wait for potential async translation
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Ignore interaction errors
    }
  });

  test('The Translator API should be available on window.Translator and not on window.ai.translator', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.aiTranslatorAccessed, 'Should not access window.ai.translator').toBe(false);
    const hasTranslator = await page.evaluate(() => 'Translator' in window);
    expect(hasTranslator, 'window.Translator should be available').toBe(true);
  });

  test('The Translator.availability() function must be called with both sourceLanguage and targetLanguage options', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.translatorAvailabilityCalled, 'Translator.availability() was not called').toBe(true);
    expect(interactions.translatorAvailabilityOptions, 'Options not provided to availability()').toBeDefined();
    expect(interactions.translatorAvailabilityOptions.sourceLanguage, 'sourceLanguage option missing').toBeDefined();
    expect(interactions.translatorAvailabilityOptions.targetLanguage, 'targetLanguage option missing').toBeDefined();
  });

  test('The Translator.availability() function should return a valid status', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.translatorAvailabilityCalled, 'Translator.availability() was not called').toBe(true);
  });

  test('Source code should specify sourceLanguage and targetLanguage options and pass them to both availability and create', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.translatorAvailabilityCalled, 'availability() not called').toBe(true);
    expect(interactions.translatorCreateCalled, 'create() not called').toBe(true);
    
    const availOpts = interactions.translatorAvailabilityOptions;
    const createOpts = interactions.translatorCreateOptions;
    
    expect(availOpts.sourceLanguage, 'sourceLanguage missing in availability').toBeDefined();
    expect(availOpts.targetLanguage, 'targetLanguage missing in availability').toBeDefined();
    expect(createOpts.sourceLanguage, 'sourceLanguage missing in create').toBe(availOpts.sourceLanguage);
    expect(createOpts.targetLanguage, 'targetLanguage missing in create').toBe(availOpts.targetLanguage);
  });

  test('Source code should call translate() or translateStreaming()', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.translatorInstanceMethodCalled, 'Neither translate() nor translateStreaming() was called on a valid Translator instance').toBe(true);
  });

  test('A monitor for download progress should be implemented using the downloadprogress event', async ({ page }) => {
    const interactions = await page.evaluate(() => window.__INTERACTIONS);
    expect(interactions.monitorProvided, 'Monitor callback not provided to Translator.create()').toBe(true);
    expect(interactions.downloadProgressListened, 'downloadprogress event listener not added to monitor').toBe(true);
  });

});
