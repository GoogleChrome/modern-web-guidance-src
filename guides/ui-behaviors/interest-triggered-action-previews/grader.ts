import { test, expect, expectNever } from '../../test-fixture.ts';
import { pathToFileURL } from 'url';

const TARGET_URL = pathToFileURL(process.env.TARGET_FILE || '').href;

test.describe('Interest-Triggered Action Previews Grader', () => {

  test('The invoker element has interestfor attribute pointing to target element ID', async ({ page }) => {
    await page.goto(TARGET_URL);
    const invoker = page.locator('[interestfor]').first();
    await expect(invoker).toBeAttached();
    
    const targetId = await invoker.getAttribute('interestfor');
    expect(targetId).toBeTruthy();
    
    const target = page.locator(`#${targetId}`);
    await expect(target).toBeAttached();
  });

  test('The target element responds to interest event to show preview state', async ({ page }) => {
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

  test('The target element responds to loseinterest event to revert preview state', async ({ page }) => {
    await page.goto(TARGET_URL);
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    
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

  test('The polyfill for interest invokers is conditionally installed', async ({ page, context }) => {
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
    await expectNever(
      page,
      () => Array.from(document.querySelectorAll('script')).some(s => /polyfill|interestfor/i.test(s.src)),
      { forMs: 300 }
    );

    expect(polyfillRequested).toBe(false);

    const unsupportedPage = await context.newPage();
    await unsupportedPage.addInitScript(() => {
      delete (HTMLButtonElement.prototype as any).interestForElement;
      delete (HTMLElement.prototype as any).interestForElement;
      delete (HTMLAnchorElement.prototype as any).interestForElement;
    });

    let polyfillRequestedWhenUnsupported = false;
    unsupportedPage.on('request', (request) => {
      if (request.url().includes('interestfor')) {
        polyfillRequestedWhenUnsupported = true;
      }
    });

    await unsupportedPage.goto(TARGET_URL);
    await expect.poll(() => polyfillRequestedWhenUnsupported).toBe(true);
    await unsupportedPage.close();

    expect(polyfillRequestedWhenUnsupported).toBe(true);
  });

  test('The implementation does not announce interest-driven preview state changes via a live region', async ({ page }) => {
    await page.goto(TARGET_URL);
    const trigger = page.locator('[interestfor]').first();
    await expect(trigger).toBeAttached();

    const liveRegions = await page.locator('[aria-live], [role="status"], [role="log"], [role="alert"], [role="marquee"], [role="timer"]').all();
    const getLiveRegionTexts = async () => {
      const texts = await Promise.all(liveRegions.map(el => el.textContent()));
      return texts.map(t => (t ?? '').trim());
    };

    const initialTexts = await getLiveRegionTexts();

    let interactiveElements = await page.locator('[interestfor]').all();
    if (interactiveElements.length === 0) {
      interactiveElements = await page.locator('button').all();
    }
    expect(interactiveElements.length).toBeGreaterThan(0);

    const liveRegionSel = '[aria-live], [role="status"], [role="log"], [role="alert"], [role="marquee"], [role="timer"]';
    const announced = ({ sel, initial }: { sel: string; initial: string[] }) =>
      JSON.stringify(Array.from(document.querySelectorAll(sel)).map(el => (el.textContent ?? '').trim())) !== JSON.stringify(initial);

    // `interest` fires after interest-delay-start (0.5s by default), so watch for longer than that.
    for (const element of interactiveElements.slice(0, 2)) {
      await element.hover();
      await expectNever(page, announced, { forMs: 800, arg: { sel: liveRegionSel, initial: initialTexts } });

      await page.locator('h1').first().hover();

      await element.focus();
      await expectNever(page, announced, { forMs: 800, arg: { sel: liveRegionSel, initial: initialTexts } });

      await element.blur();
    }
  });

});
