/**
 * The grader stubs out the built-in APIs. See
 * https://github.com/GoogleChrome/modern-web-guidance-src/pull/654#discussion_r3233433009
 * for background.
 */

import { test, expect, expectNever } from '../../../src/grading/test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

declare const process: any;

declare global {
  interface Window {
    __LM_LOGS__: {
      calls: any[];
      innerHTMLUsed: boolean;
      sessionCounter: number;
    };
    LanguageModel: any;
    ai: any;
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost/**', async (route) => {
    const filePath = path.resolve(process.env.TARGET_FILE || (process.cwd() + '/demo.html'));
    const targetDir = path.dirname(filePath);
    const demoName = path.basename(filePath);
    const requestPath = new URL(route.request().url()).pathname;
    const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

    if (fs.existsSync(localFilePath)) {
      const isJs = /\.(m?js|cjs)$/i.test(localFilePath);
      await route.fulfill({
        path: localFilePath,
        ...(isJs ? { contentType: 'application/javascript' } : {}),
      });
    } else {
      await route.continue();
    }
  });

  await page.addInitScript(() => {
    window.__LM_LOGS__ = {
      calls: [],
      innerHTMLUsed: false,
      sessionCounter: 0,
    };
    try { Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true }); } catch {}

    const originalParse = JSON.parse;
    JSON.parse = function(text: string, reviver?: any) {
      window.__LM_LOGS__.calls.push({ method: 'JSON.parse', text });
      return originalParse.call(this, text, reviver);
    };

    const originalStringify = JSON.stringify;
    JSON.stringify = function(obj: any, replacer?: any, space?: any) {
      if (obj && typeof obj === 'object' && obj.type === 'object' && obj.properties) {
        window.__LM_LOGS__.calls.push({ method: 'JSON.stringify.schema', obj });
      }
      return originalStringify.call(this, obj, replacer, space);
    };

    // Track innerHTML usage only when untrusted model output is assigned to innerHTML
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function(this: Element, value: string) {
        const strVal = String(value ?? '');
        const hasPromptExecuted = window.__LM_LOGS__.calls.some(
          (c) => c.method === 'session.prompt' || c.method === 'session.promptStreaming'
        );
        const containsModelOutput =
          strVal.includes('Mock response') ||
          strVal.includes('Mock streaming') ||
          strVal.includes('streaming response') ||
          strVal.includes('is_positive') ||
          strVal.includes('"score":1') ||
          strVal === 'Mock ' ||
          strVal === 'streaming ' ||
          strVal === 'response';
        if (hasPromptExecuted && containsModelOutput) {
          window.__LM_LOGS__.innerHTMLUsed = true;
        }
        originalInnerHTML?.set?.call(this, value);
      },
      get: function(this: Element) {
        return originalInnerHTML?.get?.call(this);
      }
    });

    class MockSession {
      _contextUsage = 10;
      _contextWindow = 1024;
      __source: string;
      __id: number;
      get contextUsage() {
        window.__LM_LOGS__.calls.push({ method: 'session.contextUsage.access' });
        return this._contextUsage;
      }
      set contextUsage(val) {
        this._contextUsage = val;
      }
      get contextWindow() {
        window.__LM_LOGS__.calls.push({ method: 'session.contextWindow.access' });
        return this._contextWindow;
      }
      set contextWindow(val) {
        this._contextWindow = val;
      }
      constructor(source: string, options?: any) {
        this.__source = source;
        this.__id = ++window.__LM_LOGS__.sessionCounter;
        window.__LM_LOGS__.calls.push({ method: 'LanguageModel.create', source, options, sessionId: this.__id });
      }
      async prompt(text: any, options: any) {
        window.__LM_LOGS__.calls.push({ method: 'session.prompt', text, options, source: this.__source });
        if (options?.responseConstraint) {
          const props = options.responseConstraint?.properties || {};
          if ('score' in props && 'category' in props && Object.keys(props).length === 2) {
            return JSON.stringify({ score: 1, category: 'positive' });
          }
          return JSON.stringify({ score: 1, rating: 5, category: 'positive', is_positive: true, summary: 'Great!' });
        }
        return 'Mock response';
      }
      // eslint-disable-next-line require-yield
      promptStreaming(text: any, options: any) {
        window.__LM_LOGS__.calls.push({ method: 'session.promptStreaming', text, options, source: this.__source });
        const stream = (async function* () {
          yield 'Mock ';
          yield 'streaming ';
          yield 'response';
        })();
        return new Proxy(stream, {
          set(target, prop, value) {
            if (prop === 'onmessage') {
              window.__LM_LOGS__.calls.push({ method: 'session.promptStreaming.onmessage' });
            }
            return Reflect.set(target, prop, value);
          }
        });
      }
      async destroy() {
        window.__LM_LOGS__.calls.push({ method: 'session.destroy', source: this.__source, sessionId: this.__id });
      }
      async clone() {
        window.__LM_LOGS__.calls.push({ method: 'session.clone', source: this.__source, sessionId: this.__id });
        return new MockSession(this.__source);
      }
      addEventListener(_type: string, _listener: any) {}
      removeEventListener(_type: string, _listener: any) {}
      dispatchEvent(_event: any) { return true; }
    }

    window.LanguageModel = {
      availability: async () => {
        window.__LM_LOGS__.calls.push({ method: 'LanguageModel.availability' });
        return 'available';
      },
      create: async (options: any) => {
        if (options?.monitor) {
          const mockMonitor = {
            addEventListener: (event: string, cb: any) => {
              window.__LM_LOGS__.calls.push({ method: 'monitor.addEventListener', event });
              if (event === 'downloadprogress') {
                setTimeout(() => {
                  try { cb({ loaded: 0.5, total: 1 }); } catch {}
                }, 0);
              }
            }
          };
          options.monitor(mockMonitor);
        }
        return new MockSession('window.LanguageModel', options);
      }
    };

    window.ai = {
      languageModel: {
        capabilities: async () => {
          window.__LM_LOGS__.calls.push({ method: 'window.ai.languageModel.capabilities' });
          return {};
        },
        create: async (options: any) => {
          window.__LM_LOGS__.calls.push({ method: 'window.ai.languageModel.create', options });
          return new MockSession('window.ai.languageModel');
        }
      }
    };
  });

  const demoName = path.basename(path.resolve(process.env.TARGET_FILE || (process.cwd() + '/demo.html')));
  await page.goto(`http://localhost/${demoName}`);
});

async function waitForPageReady(page: any) {
  await page.waitForFunction(
    () => (window as any).__LM_LOGS__?.calls?.length > 0 || document.querySelectorAll('button').length > 0,
    undefined,
    { timeout: 2000 }
  );
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

async function clickWhenReady(locator: any) {
  if (await locator.isVisible()) {
    await locator.click({ timeout: 2000 }).catch(() => {});
    await locator.page().evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
}

test('1. LanguageModel.create() should be called using window.LanguageModel', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'LanguageModel.create' && c.source === 'window.LanguageModel');
  }, { timeout: 1000 }).toBeDefined();
});

test('2. The deprecated window.ai.languageModel API must not be used', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await page.waitForFunction(() => (window as any).__LM_LOGS__?.calls?.length > 0, undefined, { timeout: 1000 });
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const deprecatedCalls = logs.calls.filter(c => c.method.startsWith('window.ai.languageModel') || c.source === 'window.ai.languageModel');
  expect(deprecatedCalls.length).toBe(0);
});

test('3. LanguageModel.availability() should be called before attempting to create a session', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.findIndex(c => c.method === 'LanguageModel.availability');
  }, { timeout: 1000 }).toBeGreaterThan(-1);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const availabilityIdx = logs.calls.findIndex(c => c.method === 'LanguageModel.availability');
  const createIdx = logs.calls.findIndex(c => c.method === 'LanguageModel.create');
  expect(availabilityIdx).toBeGreaterThan(-1);
  if (createIdx !== -1) {
    expect(availabilityIdx).toBeLessThan(createIdx);
  }
});

test('4. The deprecated capabilities() method must not be used', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await page.waitForFunction(() => (window as any).__LM_LOGS__?.calls?.length > 0, undefined, { timeout: 1000 });
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const capabilitiesCall = logs.calls.find(c => c.method.includes('capabilities'));
  expect(capabilitiesCall).toBeUndefined();
});

test('5. If LanguageModel.availability() returns "unavailable", create() must not be called', async ({ page }) => {
  await page.addInitScript(() => {
    window.LanguageModel.availability = async () => {
      window.__LM_LOGS__.calls.push({ method: 'LanguageModel.availability' });
      return 'unavailable';
    };
  });
  await page.reload();
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await expectNever(
    page,
    () => window.__LM_LOGS__.calls.some((c: any) => c.method === 'LanguageModel.create'),
    { forMs: 300 }
  );
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const availabilityCall = logs.calls.find(c => c.method === 'LanguageModel.availability');
  expect(availabilityCall).toBeDefined();
});

test('6. LanguageModel.create() should register a downloadprogress listener via monitor', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:not([disabled])').first();
  await clickWhenReady(actionBtn);
  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'monitor.addEventListener' && c.event === 'downloadprogress');
  }, { timeout: 1000 }).toBeDefined();
});

test('7. session.promptStreaming() should be used with for-await and not onmessage', async ({ page }) => {
  await waitForPageReady(page);
  const textarea = page.locator('textarea, input[type="text"]').first();
  if (await textarea.isVisible() && !(await textarea.inputValue())) await textarea.fill('Tell me about coffee');
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn').first();
  if (await actionBtn.isVisible()) {
    await clickWhenReady(actionBtn);
  } else {
    await clickWhenReady(page.locator('button:not([disabled])').first());
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'session.promptStreaming' && c.source === 'window.LanguageModel');
  }, { timeout: 1000 }).toBeDefined();
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const onmessageCall = logs.calls.find(c => c.method === 'session.promptStreaming.onmessage');
  expect(onmessageCall).toBeUndefined();
});

async function fillInputsIfEmpty(page: any) {
  await waitForPageReady(page);
  const inputs = await page.locator('textarea, input[type="text"]').all();
  for (const input of inputs) {
    if (await input.isVisible()) {
      const val = await input.inputValue();
      if (!val) {
        await input.fill('Great coffee and delicious roast!');
      }
    }
  }
}

test('8. session.prompt() should be used for one-shot responses on a modern session', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const sentimentBtn = page.locator('#sentiment-btn, #analyze-btn, [data-testid="sentiment-btn"], button:has-text("Sentiment"), button:has-text("Analyze"), button:has-text("Feedback"), button:has-text("Categorize")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  } else {
    const runBtn = page.locator('#run, #ask-the-barista, button').first();
    if (await runBtn.isVisible()) await clickWhenReady(runBtn);
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'session.prompt' && c.source === 'window.LanguageModel');
  }, { timeout: 1000 }).toBeDefined();
});

test('9. Output must never be set via innerHTML', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const actionBtn = page.locator('#ask-the-barista, #run, #prompt-btn, button:has-text("Ask"), button:has-text("Analyze"), button:has-text("Send")').first();
  if (await actionBtn.isVisible()) {
    await clickWhenReady(actionBtn);
  }
  await page.waitForFunction(
    () => {
      const calls = (window as any).__LM_LOGS__?.calls ?? [];
      return calls.some((c: any) => c.method === 'session.prompt' || c.method === 'session.promptStreaming');
    },
    undefined,
    { timeout: 2000 }
  );
  await expectNever(page, () => window.__LM_LOGS__.innerHTMLUsed, { forMs: 300 });
});

test('10. For structured output, responseConstraint option should be passed a JSON Schema', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const sentimentBtn = page.locator('#sentiment-btn, #analyze-btn, [data-testid="sentiment-btn"], button:has-text("Sentiment"), button:has-text("Analyze"), button:has-text("Feedback"), button:has-text("Categorize")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  } else {
    const runBtn = page.locator('#run, #submit, [type="submit"], button:has-text("Run"), button:has-text("Submit"), button:has-text("Analyze")').first();
    if (await runBtn.isVisible()) await clickWhenReady(runBtn);
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'session.prompt' && c.options?.responseConstraint);
  }, { timeout: 1000 }).toBeDefined();
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const promptCall = logs.calls.find(c => c.method === 'session.prompt' && c.options?.responseConstraint);
  expect(promptCall).toBeDefined();
  expect(typeof promptCall.options.responseConstraint).toBe('object');
});

test('11. Result of session.prompt() with responseConstraint should be parsed with JSON.parse()', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const sentimentBtn = page.locator('#sentiment-btn, #analyze-btn, [data-testid="sentiment-btn"], button:has-text("Sentiment"), button:has-text("Analyze"), button:has-text("Feedback"), button:has-text("Categorize")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  } else {
    const runBtn = page.locator('#run, #submit, [type="submit"], button:has-text("Run"), button:has-text("Submit"), button:has-text("Analyze")').first();
    if (await runBtn.isVisible()) await clickWhenReady(runBtn);
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'JSON.parse' && (c.text.includes('rating') || c.text.includes('score') || c.text.includes('category') || c.text.includes('positive') || c.text.includes('neutral') || c.text.includes('negative')));
  }, { timeout: 1000 }).toBeDefined();
});

test('12. JSON.stringify() on schema not needed', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const sentimentBtn = page.locator('#sentiment-btn, #analyze-btn, [data-testid="sentiment-btn"], button:has-text("Sentiment"), button:has-text("Analyze"), button:has-text("Feedback"), button:has-text("Categorize")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  }
  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.find(c => c.method === 'session.prompt' && c.options?.responseConstraint);
  }, { timeout: 1000 }).toBeDefined();
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const stringifyCall = logs.calls.find(c => c.method === 'JSON.stringify.schema');
  expect(stringifyCall).toBeUndefined();
});

test('13. session.destroy() should be called when a session is no longer needed', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const askBtn = page.locator('#ask-the-barista, #run, #prompt-btn').first();
  if (await askBtn.isVisible()) {
    await clickWhenReady(askBtn);
  }
  const sentimentBtn = page.locator('#sentiment-btn, #analyze-btn, [data-testid="sentiment-btn"], button:has-text("Sentiment"), button:has-text("Analyze")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  }
  const cloneBtn = page.locator('#clone-btn, #branch-btn, [data-testid="clone-btn"], button:has-text("Clone"), button:has-text("Branch")').first();
  if (await cloneBtn.isVisible()) {
    await clickWhenReady(cloneBtn);
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.filter(c => c.method === 'session.destroy').length;
  }, { timeout: 1000 }).toBeGreaterThan(0);
});

test('14. session.clone() usage and session cleanup', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const askBtn = page.locator('#ask-the-barista, #run, #prompt-btn').first();
  if (await askBtn.isVisible()) {
    await clickWhenReady(askBtn);
  }
  const cloneBtn = page.locator('#clone-btn, #branch-btn, [data-testid="clone-btn"], button:has-text("Clone"), button:has-text("Branch")').first();
  if (await cloneBtn.isVisible()) {
    await clickWhenReady(cloneBtn);
    const hasDestroyYet = await page.evaluate(() => (window as any).__LM_LOGS__?.calls?.some((c: any) => c.method === 'session.destroy'));
    if (!hasDestroyYet) {
      const closeBtn = page.locator('#close-session, #clear-sessions, button:has-text("Close"), button:has-text("Clear"), button:has-text("Discard"), button:has-text("Delete"), button:has-text("Remove")').first();
      if (await closeBtn.isVisible()) {
        await clickWhenReady(closeBtn);
      } else {
        await clickWhenReady(cloneBtn);
      }
    }
  }

  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return logs.calls.filter(c => c.method === 'session.clone').length;
  }, { timeout: 1000 }).toBeGreaterThan(0);

  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const destroyCalls = logs.calls.filter(c => c.method === 'session.destroy');
  expect(destroyCalls.length).toBeGreaterThan(0);
});

test('15. contextUsage and contextWindow should be used', async ({ page }) => {
  await fillInputsIfEmpty(page);
  const askBtn = page.locator('#ask-the-barista, #run, #prompt-btn').first();
  if (await askBtn.isVisible()) {
    await clickWhenReady(askBtn);
  }
  const sentimentBtn = page.locator('#sentiment-btn, button:has-text("Sentiment"), button:has-text("Analyze")').first();
  if (await sentimentBtn.isVisible()) {
    await clickWhenReady(sentimentBtn);
  }
  const cloneBtn = page.locator('#clone-btn, button:has-text("Clone")').first();
  if (await cloneBtn.isVisible()) {
    await clickWhenReady(cloneBtn);
  }
  await expect.poll(async () => {
    const logs = await page.evaluate(() => window.__LM_LOGS__);
    return (
      logs.calls.some((c: any) => c.method === 'session.contextUsage.access') &&
      logs.calls.some((c: any) => c.method === 'session.contextWindow.access')
    );
  }, { timeout: 1000 }).toBe(true);
});
