import { test, expect } from '@playwright/test';
// @ts-ignore
import * as path from 'path';

declare var process: { env: { TARGET_FILE?: string } };

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}
const filePath = path.resolve(targetFile);

// The Prompt API requires a locally downloaded Gemini Nano model and cannot be
// provisioned in CI. LanguageModel (and the legacy window.ai) are replaced with
// in-process stubs so behaviour can be verified without a real model. If you
// want to run against a real Chrome with the model present, swap the stubs for
// a simple pass-through that delegates to the real window.LanguageModel.
test.describe('Prompt API Compliance', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const spy = {
        languageModelCalled: false,
        aiCalled: false,
        availabilityCalled: false,
        capabilitiesCalled: false,
        createOptions: [] as any[],
        innerHTMLUsed: false,
        responseConstraintUsed: false,
        destroyCalled: 0,
        cloneBaseDestroyed: false,
        contextAccessed: false,
        promptOptions: [] as any[],
        streamingUsed: false,
        promptCalled: false,
        legacyStream: null as any
      };
      (window as any).spy = spy;

      // Returns a fresh session object; tracks whether destroy() is called on a
      // session that was previously cloned so Req 10 can be verified.
      const createSession = (trackAsCloneBase = false) => {
        let hasBeenCloned = false;
        return {
          prompt: async (p: any, opt: any) => {
            spy.promptCalled = true;
            spy.promptOptions.push(opt);
            if (opt?.responseConstraint && typeof opt.responseConstraint === 'object') {
              spy.responseConstraintUsed = true;
            }
            return JSON.stringify({ rating: 5, is_positive: true, summary: 'test' });
          },
          promptStreaming: async function* (p: any, opt: any) {
            spy.streamingUsed = true;
            spy.promptOptions.push(opt);
            yield 'chunk';
          },
          destroy: () => {
            spy.destroyCalled++;
            if (hasBeenCloned) {
              spy.cloneBaseDestroyed = true;
            }
          },
          clone: async function() {
            hasBeenCloned = true;
            return createSession(false);
          },
          get contextUsage() {
            spy.contextAccessed = true;
            return 10;
          },
          get contextWindow() {
            spy.contextAccessed = true;
            return 1000;
          }
        };
      };

      (window as any).LanguageModel = {
        availability: async () => {
          spy.availabilityCalled = true;
          return 'available';
        },
        create: async (options: any) => {
          spy.languageModelCalled = true;
          spy.createOptions.push(options);
          return createSession(true);
        }
      };

      (window as any).ai = {
        languageModel: {
          capabilities: async () => {
            spy.aiCalled = true;
            spy.capabilitiesCalled = true;
            return {};
          },
          create: async (options: any) => {
            spy.aiCalled = true;
            spy.createOptions.push(options);
            return {
              prompt: async () => 'legacy',
              promptStreaming: () => {
                const s = { onmessage: null };
                spy.legacyStream = s;
                return s;
              },
              get maxTokens() {
                return 1000;
              }
            };
          }
        }
      };

      const originalSet = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.set!;
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(val) {
          spy.innerHTMLUsed = true;
          originalSet.call(this, val);
        }
      });
    });

    await page.goto(`file://${filePath}`);
    await page.waitForLoadState('networkidle');
    // Allow async top-level script work (availability check, session creation)
    // to complete before querying the spy or clicking buttons.
    await page.waitForTimeout(500);

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      try {
        if (await btn.isVisible() && await btn.isEnabled()) {
          await btn.click({ timeout: 1000 });
          // Allow the async click handler to resolve before moving to the next button.
          await page.waitForTimeout(300);
        }
      } catch (e) {
        console.error('Error while clicking button during setup:', e);
      }
    }
  });

  test('Requirement 1: Should use window.LanguageModel and not legacy window.ai', async ({ page }) => {
    const aiCalled = await page.evaluate(() => (window as any).spy.aiCalled);
    expect(aiCalled, 'Legacy window.ai should not be used').toBe(false);
  });

  test('Requirement 1 (part 2): Should call LanguageModel.create', async ({ page }) => {
    const lmCalled = await page.evaluate(() => (window as any).spy.languageModelCalled);
    expect(lmCalled, 'LanguageModel.create should be called').toBe(true);
  });

  test('Requirement 2: Should call LanguageModel.availability()', async ({ page }) => {
    const availCalled = await page.evaluate(() => (window as any).spy.availabilityCalled);
    expect(availCalled, 'LanguageModel.availability() should be called').toBe(true);
  });

  test('Requirement 2 (part 2): Should not call deprecated capabilities()', async ({ page }) => {
    const capCalled = await page.evaluate(() => (window as any).spy.capabilitiesCalled);
    expect(capCalled, 'capabilities() is deprecated and should not be used').toBe(false);
  });

  test('Requirement 4: Should register monitor in create()', async ({ page }) => {
    const hasMonitor = await page.evaluate(() => (window as any).spy.createOptions.some((o: any) => o?.monitor));
    expect(hasMonitor, 'LanguageModel.create should include monitor for progress').toBe(true);
  });

  test('Requirement 5: Should use promptStreaming() for streaming output', async ({ page }) => {
    const streamingUsed = await page.evaluate(() => (window as any).spy.streamingUsed);
    expect(streamingUsed, 'promptStreaming() should be used for streaming results').toBe(true);
  });

  test('Requirement 6: Should not use innerHTML for output', async ({ page }) => {
    const innerHTMLUsed = await page.evaluate(() => (window as any).spy.innerHTMLUsed);
    expect(innerHTMLUsed, 'innerHTML should never be used, use textContent or similar instead').toBe(false);
  });

  test('Requirement 7: Should use responseConstraint for structured output', async ({ page }) => {
    const rcUsed = await page.evaluate(() => (window as any).spy.responseConstraintUsed);
    expect(rcUsed, 'responseConstraint should be used for structured JSON output').toBe(true);
  });

  test('Requirement 8: Should use prompt() for one-shot responses', async ({ page }) => {
    const promptCalled = await page.evaluate(() => (window as any).spy.promptCalled);
    expect(promptCalled, 'session.prompt() should be called for one-shot responses').toBe(true);
  });

  test('Requirement 9: Should call session.destroy() when finished', async ({ page }) => {
    const destroyCalled = await page.evaluate(() => (window as any).spy.destroyCalled);
    expect(destroyCalled, 'session.destroy() should be called to free memory').toBeGreaterThan(0);
  });

  test('Requirement 10: Should not pass AbortSignal to create()', async ({ page }) => {
    const signalInCreate = await page.evaluate(() => (window as any).spy.createOptions.some((o: any) => o?.signal));
    expect(signalInCreate, 'AbortSignal should be passed to prompt(), not to create()').toBe(false);
  });

  test('Requirement 11: Should destroy base session after cloning', async ({ page }) => {
    const cloneBaseDestroyed = await page.evaluate(() => (window as any).spy.cloneBaseDestroyed);
    expect(cloneBaseDestroyed, 'The base session should be destroyed after cloning').toBe(true);
  });

  test('Requirement 12: Should access contextUsage or contextWindow', async ({ page }) => {
    const ctxAccessed = await page.evaluate(() => (window as any).spy.contextAccessed);
    expect(ctxAccessed, 'contextUsage and contextWindow should be monitored').toBe(true);
  });

});

// Requirement 3 requires a separate page setup because the main stub always
// returns 'available'; here availability returns 'unavailable' to verify that
// the implementation does not call create() in that case.
test.describe('Prompt API - Unavailability Handling', () => {
  test('Requirement 3: Should not call LanguageModel.create() when unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const unavailSpy = { createCalled: false };
      (window as any).unavailSpy = unavailSpy;
      (window as any).LanguageModel = {
        availability: async () => 'unavailable',
        create: async () => {
          unavailSpy.createCalled = true;
          return {};
        },
      };
    });
    await page.goto(`file://${filePath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const createCalled = await page.evaluate(() => (window as any).unavailSpy.createCalled);
    expect(createCalled, 'LanguageModel.create() must not be called when availability is "unavailable"').toBe(false);
  });
});
