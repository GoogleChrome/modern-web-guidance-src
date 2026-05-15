import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Global helper to deduplicate all MutationObserver boilerplate
async function waitForAnimationSpy(page: Page, triggerAction: () => Promise<void>) {
  await page.evaluate(() => {
    (window as any)._animationObserved = false;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target;
        if (target instanceof Element && target.getAnimations && target.getAnimations().length > 0) {
          (window as any)._animationObserved = true;
        }
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element && node.getAnimations && node.getAnimations().length > 0) {
            (window as any)._animationObserved = true;
          }
        }
      }
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  });

  await triggerAction();

  // Puppeteer's waitForFunction is used to poll.
  // FLAKINESS RISK: If triggerAction causes navigation, or if the page crashes/reloads,
  // waitForFunction might throw a cryptic "Execution context was destroyed" error.
  await page.waitForFunction(() => (window as any)._animationObserved, { timeout: 2000 });
}

describe(`animate-element-entry-exit Expectations (Puppeteer): ${demoName}`, () => {
  let browser: Browser;
  let page: Page;

  // Launching browser manually.
  // FLAKINESS RISK: Browser launching/connection can fail or timeout under heavy CI load.
  test.before(async () => {
    browser = await puppeteer.launch({
      headless: true,
    });
  });

  test.after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // FLAKINESS RISK: Request interception in Puppeteer is notorious for race conditions.
    // If not handled correctly, it can hang requests indefinitely or cause "Request is already handled" errors.
    await page.setRequestInterception(true);
    page.on('request', async (route) => {
      try {
        const requestUrl = route.url();
        const requestPath = new URL(requestUrl).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.substring(1));

        if (fs.existsSync(localFilePath)) {
          const body = await fs.promises.readFile(localFilePath);
          const extension = path.extname(localFilePath);
          let contentType = 'text/plain';
          if (extension === '.html') contentType = 'text/html';
          else if (extension === '.css') contentType = 'text/css';
          else if (extension === '.js') contentType = 'application/javascript';

          await route.respond({
            status: 200,
            contentType,
            body,
          });
        } else {
          await route.continue();
        }
      } catch (err) {
        // FLAKINESS RISK: Uncaught errors in interception handler will crash the test or leak request.
        console.error('Request interception error:', err);
        try { await route.abort(); } catch {}
      }
    });

    await page.goto(demoUrl);
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test(`uses @starting-style to define starting property values for entry animation`, async () => {
    const hasStartingStyle = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.constructor.name === 'CSSStartingStyleRule') return true;
            if (rule.cssText && rule.cssText.includes('@starting-style')) return true;
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    assert.strictEqual(hasStartingStyle, true);
  });

  test(`includes transition-behavior: allow-discrete or allow-discrete keyword for display`, async () => {
    // FLAKINESS RISK: No auto-waiting in Puppeteer!
    // We must manually wait for the element to exist in DOM first.
    // If it takes more than 2s to render, this throws a TimeoutError.
    await page.waitForSelector('.card', { timeout: 2000 });

    // FLAKINESS RISK: Evaluating styles on elements.
    // If the element is removed/re-rendered from DOM between the waitForSelector and evaluate,
    // document.querySelector inside evaluate will return null, causing a TypeError.
    const transitionBehavior = await page.evaluate(() => {
      const el = document.querySelector('.card');
      return el ? window.getComputedStyle(el).transitionBehavior : null;
    });
    assert.match(transitionBehavior || '', /allow-discrete/);
  });

  test(`includes display property in transition list`, async () => {
    await page.waitForSelector('.card', { timeout: 2000 });
    const transitionProperty = await page.evaluate(() => {
      const el = document.querySelector('.card');
      return el ? window.getComputedStyle(el).transitionProperty : null;
    });
    assert.ok(transitionProperty?.includes('display'));
  });

  test(`smoothly transitions properties when added to DOM`, async () => {
    // FLAKINESS RISK: Puppeteer's click doesn't check if the button is fully interactive
    // (e.g. not animated, not covered, not disabled). It just calculates coords and clicks.
    // If the button is covered by another loading element, the click hits that element instead.
    await page.waitForSelector('#addBtn', { visible: true, timeout: 2000 });
    
    await waitForAnimationSpy(page, async () => {
      await page.click('#addBtn');
    });
  });

  test(`smoothly transitions to hidden values before being hidden from layout`, async () => {
    // FLAKINESS RISK: Checking visibility.
    // In Puppeteer, we manually check if it is visible.
    // waitForSelector with { visible: true } is used here.
    await page.waitForSelector('#toggleCard', { visible: true, timeout: 2000 });

    await page.waitForSelector('#toggleBtn', { visible: true, timeout: 2000 });
    await waitForAnimationSpy(page, async () => {
      await page.click('#toggleBtn');
    });
  });

  test(`smoothly transitions properties from @starting-style values when display changes from none to visible`, async () => {
    // FLAKINESS RISK: Conditional checking of visibility in Puppeteer.
    // Since there's no clean isVisible() that returns false immediately if not present/hidden,
    // we must evaluate its visibility in the page, or run waitForSelector with a short timeout and catch the error.
    // Catching timeout errors adds substantial delay (500ms here) to test runs.
    let isVisible = false;
    try {
      await page.waitForSelector('#toggleCard', { visible: true, timeout: 500 });
      isVisible = true;
    } catch (e) {
      isVisible = false;
    }

    if (isVisible) {
      await page.waitForSelector('#toggleBtn', { visible: true, timeout: 2000 });
      await page.click('#toggleBtn');
      // Wait for it to be hidden
      await page.waitForSelector('#toggleCard', { hidden: true, timeout: 2000 });
    }

    await page.waitForSelector('#toggleBtn', { visible: true, timeout: 2000 });
    await waitForAnimationSpy(page, async () => {
      await page.click('#toggleBtn');
    });
  });

  test(`waits for exit transition to complete before removing element from DOM`, async () => {
    await page.evaluate(() => {
      (window as any)._removeSpyCalled = false;
      (window as any)._removeWasDelayed = false;
      (window as any)._clickTimestamp = 0;

      document.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.id === 'removeBtn') {
          (window as any)._clickTimestamp = performance.now();
        }
      }, { capture: true });

      const originalRemove = Element.prototype.remove;
      Element.prototype.remove = function () {
        (window as any)._removeSpyCalled = true;
        if ((window as any)._clickTimestamp > 0 && (performance.now() - (window as any)._clickTimestamp) > 100) {
          (window as any)._removeWasDelayed = true;
        }
        originalRemove.call(this);
      };
    });

    await page.waitForSelector('#removeBtn', { visible: true, timeout: 2000 });
    await page.click('#removeBtn');

    // FLAKINESS RISK: waitForFunction relies on browser-side state.
    // If the page reloads, the state is cleared and this waits forever (until timeout).
    await page.waitForFunction(() => (window as any)._removeSpyCalled && (window as any)._removeWasDelayed, { timeout: 2000 });
  });

  test(`transition durations for entry and exit are reasonable (0.3s to 1s)`, async () => {
    await page.waitForSelector('.card', { timeout: 2000 });
    const transitionDuration = await page.evaluate(() => {
      const el = document.querySelector('.card');
      return el ? window.getComputedStyle(el).transitionDuration : null;
    });
    const durations = (transitionDuration || '').split(',').map(s => parseFloat(s));

    const hasReasonableDuration = durations.some(d => d >= 0.3 && d <= 1.0);
    assert.strictEqual(hasReasonableDuration, true);
  });
});
