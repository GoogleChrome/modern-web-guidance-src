import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';

const TARGET_URL = pathToFileURL(process.env.TARGET_FILE || '').href;

test.describe('Interest-Triggered Action Previews Grader', () => {

  test('invoker element has interestfor attribute pointing to target element ID', async ({ page }) => {
    await page.goto(TARGET_URL);
    const invoker = page.locator('[interestfor]').first();
    await expect(invoker).toBeAttached();
    
    const targetId = await invoker.getAttribute('interestfor');
    expect(targetId).toBeTruthy();
    
    const target = page.locator(`#${targetId}`);
    await expect(target).toBeAttached();
  });

  test('target element responds to interest event to show preview state', async ({ page }) => {
    await page.goto(TARGET_URL);
    
    const invoker = page.locator('[interestfor]').first();
    await expect(invoker).toBeAttached();
    
    const targetId = await invoker.getAttribute('interestfor');
    const target = page.locator(`#${targetId}`);
    await expect(target).toBeAttached();
    
    const initialText = await target.textContent();
    const initialBg = await target.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    await target.evaluate((targetEl) => {
      const invokerEl = document.querySelector('[interestfor]');
      if (!invokerEl) throw new Error('No invoker element with [interestfor] found');
      const event = new Event('interest', { bubbles: true });
      Object.defineProperty(event, 'source', { value: invokerEl });
      targetEl.dispatchEvent(event);
    });
    
    const previewText = await target.textContent();
    const previewBg = await target.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    const hasChanged = (previewText !== initialText) || (previewBg !== initialBg);
    expect(hasChanged).toBe(true);
  });

  test('target element responds to loseinterest event to revert preview state', async ({ page }) => {
    await page.goto(TARGET_URL);
    
    const invoker = page.locator('[interestfor]').first();
    await expect(invoker).toBeAttached();
    
    const targetId = await invoker.getAttribute('interestfor');
    const target = page.locator(`#${targetId}`);
    await expect(target).toBeAttached();
    
    const initialText = await target.textContent();
    const initialBg = await target.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    await target.evaluate((targetEl) => {
      const invokerEl = document.querySelector('[interestfor]');
      if (!invokerEl) throw new Error('No invoker element with [interestfor] found');
      const event = new Event('interest', { bubbles: true });
      Object.defineProperty(event, 'source', { value: invokerEl });
      targetEl.dispatchEvent(event);
    });
    
    await target.evaluate((targetEl) => {
      const invokerEl = document.querySelector('[interestfor]');
      if (!invokerEl) throw new Error('No invoker element with [interestfor] found');
      const event = new Event('loseinterest', { bubbles: true });
      Object.defineProperty(event, 'source', { value: invokerEl });
      targetEl.dispatchEvent(event);
    });
    
    const finalText = await target.textContent();
    const finalBg = await target.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    const matchesInitial = (finalText === initialText) && (finalBg === initialBg);
    expect(matchesInitial).toBe(true);
  });

  test('the polyfill for interest invokers is conditionally installed', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLButtonElement.prototype, 'interestForElement', {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    let polyfillRequested = false;
    page.on('request', (request) => {
      if (request.url().includes('interestfor')) {
        polyfillRequested = true;
      }
    });

    await page.goto(TARGET_URL);
    await page.waitForTimeout(500);

    expect(polyfillRequested).toBe(false);
  });

  test('must not announce interest-driven preview state changes via a live region', async ({ page }) => {
    await page.goto(TARGET_URL);

    const liveRegions = await page.locator('[aria-live], [role="status"], [role="log"], [role="alert"], [role="marquee"], [role="timer"]').all();
    
    if (liveRegions.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const getLiveRegionTexts = async () => {
      return Promise.all(liveRegions.map(el => el.textContent()));
    };

    const initialTexts = await getLiveRegionTexts();

    let interactiveElements = await page.locator('[interestfor]').all();
    if (interactiveElements.length === 0) {
      interactiveElements = await page.locator('button').all();
    }

    for (const element of interactiveElements) {
      await element.hover();
      await page.waitForTimeout(100);
      const hoverTexts = await getLiveRegionTexts();
      expect(hoverTexts).toEqual(initialTexts);

      await page.locator('h1').first().hover();
      await page.waitForTimeout(100);

      await element.focus();
      await page.waitForTimeout(100);
      const focusTexts = await getLiveRegionTexts();
      expect(focusTexts).toEqual(initialTexts);

      await element.blur();
      await page.waitForTimeout(100);
    }
  });

});
