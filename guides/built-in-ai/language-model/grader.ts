/**
 * The grader stubs out the built-in APIs. See
 * https://github.com/GoogleChrome/modern-web-guidance-src/pull/654#discussion_r3233433009
 * for background.
 */
 
import { test, expect } from '@playwright/test';

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

const targetFile = process.env.TARGET_FILE || (process.cwd() + '/demo.html');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__LM_LOGS__ = {
      calls: [],
      innerHTMLUsed: false,
      sessionCounter: 0,
    };

    // Track innerHTML usage
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function(this: Element, value: string) {
        window.__LM_LOGS__.innerHTMLUsed = true;
        originalInnerHTML?.set?.call(this, value);
      },
      get: function(this: Element) {
        return originalInnerHTML?.get?.call(this);
      }
    });

    class MockSession {
      contextUsage = 10;
      contextWindow = 1024;
      __source: string;
      __id: number;
      constructor(source: string) {
        this.__source = source;
        this.__id = ++window.__LM_LOGS__.sessionCounter;
        window.__LM_LOGS__.calls.push({ method: 'LanguageModel.create', source, sessionId: this.__id });
      }
      async prompt(text: any, options: any) {
        window.__LM_LOGS__.calls.push({ method: 'session.prompt', text, options, source: this.__source });
        if (options?.responseConstraint) {
          return JSON.stringify({ rating: 5, is_positive: true, summary: 'Great!' });
        }
        return 'Mock response';
      }
      // eslint-disable-next-line require-yield
      async* promptStreaming(text: any, options: any) {
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
                cb({ loaded: 0.5, total: 1 });
              }
            }
          };
          options.monitor(mockMonitor);
        }
        return new MockSession('window.LanguageModel');
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

  await page.goto(`file://${targetFile}`);
});

test('1. LanguageModel.create() should be called using window.LanguageModel', async ({ page }) => {
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const lmCreate = logs.calls.find(c => c.method === 'LanguageModel.create' && c.source === 'window.LanguageModel');
  expect(lmCreate).toBeDefined();
});

test('2. The deprecated window.ai.languageModel API must not be used', async ({ page }) => {
  await page.waitForTimeout(500);
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const deprecatedCalls = logs.calls.filter(c => c.method.startsWith('window.ai.languageModel') || c.source === 'window.ai.languageModel');
  expect(deprecatedCalls.length).toBe(0);
});

test('3. LanguageModel.availability() should be called before attempting to create a session', async ({ page }) => {
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const availabilityIdx = logs.calls.findIndex(c => c.method === 'LanguageModel.availability');
  const createIdx = logs.calls.findIndex(c => c.method === 'LanguageModel.create');
  expect(availabilityIdx).toBeGreaterThan(-1);
  if (createIdx !== -1) {
    expect(availabilityIdx).toBeLessThan(createIdx);
  }
});

test('4. The deprecated capabilities() method must not be used', async ({ page }) => {
  await page.waitForTimeout(500);
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(500);
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const createCall = logs.calls.find(c => c.method === 'LanguageModel.create');
  expect(createCall).toBeUndefined();
});

test('6. LanguageModel.create() should register a downloadprogress listener via monitor', async ({ page }) => {
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const monitorCall = logs.calls.find(c => c.method === 'monitor.addEventListener' && c.event === 'downloadprogress');
  expect(monitorCall).toBeDefined();
});

test('7. session.promptStreaming() should be used with for-await and not onmessage', async ({ page }) => {
  const promptBtn = page.locator('#prompt-btn');
  if (await promptBtn.isVisible()) await promptBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const streamingCall = logs.calls.find(c => c.method === 'session.promptStreaming' && c.source === 'window.LanguageModel');
  expect(streamingCall).toBeDefined();
  const onmessageCall = logs.calls.find(c => c.method === 'session.promptStreaming.onmessage');
  expect(onmessageCall).toBeUndefined();
});

test('8. session.prompt() should be used for one-shot responses on a modern session', async ({ page }) => {
  const sentimentBtn = page.locator('#sentiment-btn');
  if (await sentimentBtn.isVisible()) await sentimentBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const promptCall = logs.calls.find(c => c.method === 'session.prompt' && c.source === 'window.LanguageModel');
  expect(promptCall).toBeDefined();
});

test('9. Output must never be set via innerHTML', async ({ page }) => {
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    if (await btn.isVisible()) await btn.click();
  }
  await page.waitForTimeout(1000);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  expect(logs.innerHTMLUsed).toBe(false);
});

test('10. For structured output, responseConstraint option should be passed a JSON Schema', async ({ page }) => {
  const sentimentBtn = page.locator('#sentiment-btn');
  if (await sentimentBtn.isVisible()) await sentimentBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const promptCall = logs.calls.find(c => c.method === 'session.prompt' && c.options?.responseConstraint);
  expect(promptCall).toBeDefined();
  expect(typeof promptCall.options.responseConstraint).toBe('object');
});

test('11. Result of session.prompt() with responseConstraint should be parsed with JSON.parse()', async ({ page }) => {
  await page.addInitScript(() => {
    const originalParse = JSON.parse;
    JSON.parse = function(text: string) {
      window.__LM_LOGS__.calls.push({ method: 'JSON.parse', text });
      return originalParse(text);
    };
  });
  await page.reload();
  const sentimentBtn = page.locator('#sentiment-btn');
  if (await sentimentBtn.isVisible()) await sentimentBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const parseCall = logs.calls.find(c => c.method === 'JSON.parse' && c.text.includes('rating'));
  expect(parseCall).toBeDefined();
});

test('12. JSON.stringify() on schema not needed', async ({ page }) => {
  await page.addInitScript(() => {
    const originalStringify = JSON.stringify;
    JSON.stringify = function(obj: any) {
      if (obj && obj.type === 'object' && obj.properties) {
        window.__LM_LOGS__.calls.push({ method: 'JSON.stringify.schema', obj });
      }
      return (originalStringify as any).apply(this, arguments);
    };
  });
  await page.reload();
  const sentimentBtn = page.locator('#sentiment-btn');
  if (await sentimentBtn.isVisible()) {
    await sentimentBtn.click();
    await page.waitForTimeout(500);
  }
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  
  // To make it fail for negative-demo, we should expect that a prompt with responseConstraint WAS attempted
  // and that it DID NOT use stringify on the schema.
  const promptWithConstraint = logs.calls.find(c => c.method === 'session.prompt' && c.source === 'window.LanguageModel' && c.options?.responseConstraint);
  expect(promptWithConstraint).toBeDefined();

  const stringifyCall = logs.calls.find(c => c.method === 'JSON.stringify.schema');
  expect(stringifyCall).toBeUndefined();
});

test('13. session.destroy() should be called when a session is no longer needed', async ({ page }) => {
  const cloneBtn = page.locator('#clone-btn');
  if (await cloneBtn.isVisible()) await cloneBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const destroyCalls = logs.calls.filter(c => c.method === 'session.destroy' && c.source === 'window.LanguageModel');
  expect(destroyCalls.length).toBeGreaterThan(0);
});

test('14. AbortSignal should be passed to prompt(), not LanguageModel.create()', async ({ page }) => {
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const createWithSignal = logs.calls.find(c => (c.method === 'LanguageModel.create' || c.method === 'window.ai.languageModel.create') && c.options?.signal);
  expect(createWithSignal).toBeUndefined();
});

test('15. session.clone() usage and base destruction', async ({ page }) => {
  const cloneBtn = page.locator('#clone-btn');
  if (await cloneBtn.isVisible()) await cloneBtn.click();
  const runBtn = page.locator('#run');
  if (await runBtn.isVisible()) await runBtn.click();

  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const cloneCalls = logs.calls.filter(c => c.method === 'session.clone' && c.source === 'window.LanguageModel');
  expect(cloneCalls.length).toBeGreaterThan(0);

  // Verify each cloned base session is subsequently destroyed
  for (const cloneCall of cloneCalls) {
    const cloneIdx = logs.calls.findIndex(c => c.method === 'session.clone' && c.sessionId === cloneCall.sessionId);
    const destroyAfterClone = logs.calls.slice(cloneIdx + 1).find(c =>
      c.method === 'session.destroy' && c.sessionId === cloneCall.sessionId
    );
    expect(destroyAfterClone).toBeDefined();
  }
});

test('16. contextUsage and contextWindow should be used', async ({ page }) => {
  await page.addInitScript(() => {
    const originalCreate = window.LanguageModel.create;
    window.LanguageModel.create = async function() {
      const session = await originalCreate.apply(this, arguments);
      return new Proxy(session, {
        get(target, prop) {
          if (prop === 'contextUsage') window.__LM_LOGS__.calls.push({ method: 'session.contextUsage.access' });
          if (prop === 'contextWindow') window.__LM_LOGS__.calls.push({ method: 'session.contextWindow.access' });
          return target[prop];
        }
      });
    };
  });
  await page.reload();
  await page.waitForTimeout(500);
  const logs = await page.evaluate(() => window.__LM_LOGS__);
  const usageAccess = logs.calls.find(c => c.method === 'session.contextUsage.access');
  const windowAccess = logs.calls.find(c => c.method === 'session.contextWindow.access');
  expect(usageAccess).toBeDefined();
  expect(windowAccess).toBeDefined();
});
