import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || '';
const targetUrl = `file://${targetFile}`;

test.describe('Defer Work Until Scroll Ends', () => {
  // Helper to trigger scroll in a direction-agnostic way
  const triggerScroll = async (scrollerLocator: any, distance: number) => {
    await scrollerLocator.evaluate((el: any, dist: any) => {
      const style = window.getComputedStyle(el);
      const isHorizontal = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (isHorizontal) {
        el.scrollLeft = dist;
      } else {
        el.scrollTop = dist;
      }
      el.dispatchEvent(new Event('scroll'));
    }, distance);
  };

  test.beforeEach(async () => {
    // If targetUrl is not set properly, fail fast
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable is not set.');
    }
  });

  test('should register a scrollend event listener', async ({ page }) => {
    // 1. Inject addEventListener spy before the page scripts run
    await page.addInitScript(() => {
      (window as any).__registeredListeners = [];
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type: string, _listener: any, _options: any) {
        (window as any).__registeredListeners.push({
          type,
          targetTagName: (this as any).tagName || null,
          targetId: (this as any).id || null,
          targetClass: (this as any).className || null,
          isWindow: this === window,
          isDocument: this === document,
        });
        return original.apply(this, arguments as any);
      };
    });

    // 2. Load target page
    await page.goto(targetUrl);

    // 3. Retrieve registered listeners
    const listeners = await page.evaluate(() => (window as any).__registeredListeners);
    
    // 4. Check if scrollend listener was added
    const hasScrollend = listeners.some((l: any) => l.type === 'scrollend');
    expect(hasScrollend).toBe(true);
  });

  test('should fall back to debounced scroll event using window.scrollendtimer when native scrollend is missing', async ({ page }) => {
    // 1. Mock missing scrollend support by deleting the properties and setup spy
    await page.addInitScript(() => {
      delete (window as any).onscrollend;
      delete (Document.prototype as any).onscrollend;
      delete (HTMLElement.prototype as any).onscrollend;

      (window as any).__scrollendTimerCreated = false;
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function (this: any, _callback: any, _delay: any) {
        const timer = originalSetTimeout.apply(this, arguments as any);
        (window as any).__scrollendTimerCreated = true;
        return timer;
      } as any;
    });

    // 2. Load the page
    await page.goto(targetUrl);

    // 3. Trigger a scroll event on the scroll container
    const scroller = page.locator('#scroller');
    await triggerScroll(scroller, 50);

    // 4. Check if window.scrollendtimer was created OR spy caught the timeout trigger
    const hasTimer = await page.evaluate(() => {
      return (window as any).scrollendtimer !== undefined || (window as any).__scrollendTimerCreated === true;
    });

    expect(hasTimer).toBe(true);
  });

  test('should dispatch a custom scrollend event in fallback mode after scroll ceases', async ({ page }) => {
    // 1. Mock missing scrollend support
    await page.addInitScript(() => {
      delete (window as any).onscrollend;
      delete (Document.prototype as any).onscrollend;
      delete (HTMLElement.prototype as any).onscrollend;
    });

    // 2. Load the page
    await page.goto(targetUrl);

    // 3. Scroll the container
    const scroller = page.locator('#scroller');
    await triggerScroll(scroller, 100);

    // 4. Wait for debounce timeout to fire
    await page.waitForTimeout(200);

    // 5. Verify the status text changed indicating scroll completion
    const statusText = await page.locator('#status').textContent();
    expect(statusText).toContain('Scroll ended');
  });

  test('should not execute heavy layout calculations or style changes inside scroll event listener', async ({ page }) => {
    // 1. Inject spy on addEventListener, layout properties, and performance timing
    await page.addInitScript(() => {
      (window as any).__scrollLayoutReads = 0;
      (window as any).__scrollListenerDuration = 0;
      (window as any).__scrollListenerRunning = false;

      // Spying on layout-triggering methods
      const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        if ((window as any).__scrollListenerRunning) {
          (window as any).__scrollLayoutReads++;
        }
        return originalGetBoundingClientRect.apply(this, arguments as any);
      };

      // Spying on layout properties on HTMLElement
      const propertiesToSpy = ['offsetHeight', 'offsetTop', 'scrollTop', 'scrollHeight', 'clientHeight', 'clientTop'];
      for (const prop of propertiesToSpy) {
        const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
        if (desc && desc.get) {
          const originalGet = desc.get;
          Object.defineProperty(HTMLElement.prototype, prop, {
            ...desc,
            get: function () {
              if ((window as any).__scrollListenerRunning) {
                (window as any).__scrollLayoutReads++;
              }
              return originalGet.apply(this, arguments as any);
            }
          });
        }
      }

      // Spying on addEventListener to wrap scroll listeners
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type: string, listener: any, _options: any) {
        if (type === 'scroll' && typeof listener === 'function') {
          const originalListener = listener;
          const wrappedListener = function (this: any, _event: any) {
            (window as any).__scrollListenerRunning = true;
            const start = performance.now();
            const result = originalListener.apply(this, arguments as any);
            const duration = performance.now() - start;
            (window as any).__scrollListenerDuration += duration;
            (window as any).__scrollListenerRunning = false;
            return result;
          };
          return originalAddEventListener.call(this, type, wrappedListener, _options);
        }
        return originalAddEventListener.apply(this, arguments as any);
      };
    });

    // 2. Load page
    await page.goto(targetUrl);

    // 3. Perform scroll to trigger scroll handlers on both scroller and window
    const scroller = page.locator('#scroller');
    await triggerScroll(scroller, 20);
    await triggerScroll(scroller, 40);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Wait a moment for any processing
    await page.waitForTimeout(50);

    // 4. Retrieve layout reads and execution time
    const { layoutReads, duration } = await page.evaluate(() => {
      return {
        layoutReads: (window as any).__scrollLayoutReads,
        duration: (window as any).__scrollListenerDuration,
      };
    });

    // Assert that layout reads inside scroll event is 0
    expect(layoutReads).toBe(0);
    // Assert that scroll event execution duration is very short (< 5ms)
    expect(duration).toBeLessThan(5);
  });

  test('should not use scroll debouncing fallback when native scrollend is supported', async ({ page }) => {
    // 1. Inject addEventListener spy before the page scripts run
    await page.addInitScript(() => {
      (window as any).__registeredListeners = [];
      const original = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type: string, _listener: any, _options: any) {
        (window as any).__registeredListeners.push({
          type,
          targetTagName: (this as any).tagName || null,
          targetId: (this as any).id || null,
          targetClass: (this as any).className || null,
          isWindow: this === window,
          isDocument: this === document,
        });
        return original.apply(this, arguments as any);
      };
    });

    // 2. Load page under native support
    await page.goto(targetUrl);

    // 3. Trigger scroll
    const scroller = page.locator('#scroller');
    await triggerScroll(scroller, 50);

    // 4. Retrieve registered listeners and timer
    const { listeners, hasTimer } = await page.evaluate(() => {
      return {
        listeners: (window as any).__registeredListeners,
        hasTimer: (window as any).scrollendtimer !== undefined || (window as any).__scrollendTimerCreated === true
      };
    });

    // 5. Assert that scrollend event listener is registered
    const hasScrollend = listeners.some((l: any) => l.type === 'scrollend');
    expect(hasScrollend).toBe(true);

    // 6. Assert that scroll timer fallback was not initialized
    expect(hasTimer).toBe(false);
  });

  test('should have a scrollable container with overflow: auto or scroll', async ({ page }) => {
    await page.goto(targetUrl);

    const isScrollable = await page.locator('#scroller').evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll' ||
             style.overflowX === 'auto' || style.overflowX === 'scroll';
    });

    expect(isScrollable).toBe(true);
  });
});
