import { test, expect } from '@playwright/test';

// Helper function to check if a string contains any non-zero length/size value
const hasNonZeroSize = (val: string | null): boolean => {
  if (!val) return false;
  if (val === 'none') return false;
  const numbers = val.match(/\d+(\.\d+)?/g);
  if (!numbers) return false;
  return numbers.some(n => parseFloat(n) > 0);
};

test.describe('Efficient Background Processing Grader', () => {

  test('The target element must have content-visibility: auto applied in its computed styles', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';
    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    const hasElement = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
    });

    expect(hasElement).toBe(true);
  });

  test('The target element must have a non-zero contain-intrinsic-size applied to provide a placeholder height', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';
    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    const containIntrinsicSize = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const target = allElements.find(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
      if (!target) return null;
      const style = window.getComputedStyle(target);
      return style.containIntrinsicSize || style.getPropertyValue('contain-intrinsic-size');
    });

    expect(containIntrinsicSize).not.toBeNull();
    expect(hasNonZeroSize(containIntrinsicSize)).toBe(true);
  });

  test('The application must respond to the contentvisibilityautostatechange event', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';

    // Register a spy for the contentvisibilityautostatechange event
    await page.addInitScript(() => {
      let registered = false;
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'contentvisibilityautostatechange') {
          registered = true;
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      (window as any).__hasRegisteredCvEvent = () => registered;
    });

    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    const registered = await page.evaluate(() => (window as any).__hasRegisteredCvEvent());
    expect(registered).toBe(true);
  });

  test('The application must pause active canvas animations or high-frequency tasks when the contentvisibilityautostatechange event reports skipped: true', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';

    await page.addInitScript(() => {
      let rafCalls = 0;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        rafCalls++;
        return originalRaf.call(this, callback);
      };
      (window as any).__getRafCalls = () => rafCalls;
      (window as any).__resetRafCalls = () => { rafCalls = 0; };
    });

    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    // Trigger skipped: true on the content-visibility element
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const target = allElements.find(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
      if (target) {
        const event = new Event('contentvisibilityautostatechange');
        Object.defineProperty(event, 'skipped', { value: true, enumerable: true });
        target.dispatchEvent(event);
      }
    });

    // Let any initial or pending frames settle, then reset
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__resetRafCalls());

    // Wait and verify that RAF is not ticking
    await page.waitForTimeout(300);
    const rafCalls = await page.evaluate(() => (window as any).__getRafCalls());

    expect(rafCalls).toBeLessThanOrEqual(1);
  });

  test('The application must resume active canvas animations or high-frequency tasks when the contentvisibilityautostatechange event reports skipped: false', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';

    await page.addInitScript(() => {
      let rafCalls = 0;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        rafCalls++;
        return originalRaf.call(this, callback);
      };
      (window as any).__getRafCalls = () => rafCalls;
      (window as any).__resetRafCalls = () => { rafCalls = 0; };
    });

    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    // Step 1: Force pause state off-screen initially
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const target = allElements.find(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
      if (target) {
        const event = new Event('contentvisibilityautostatechange');
        Object.defineProperty(event, 'skipped', { value: true, enumerable: true });
        target.dispatchEvent(event);
      }
    });

    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__resetRafCalls());
    await page.waitForTimeout(300);
    const initialRafCalls = await page.evaluate(() => (window as any).__getRafCalls());

    // Expecting background task to be successfully paused
    expect(initialRafCalls).toBeLessThanOrEqual(1);

    // Step 2: Trigger skipped: false to resume rendering
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const target = allElements.find(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
      if (target) {
        const event = new Event('contentvisibilityautostatechange');
        Object.defineProperty(event, 'skipped', { value: false, enumerable: true });
        target.dispatchEvent(event);
      }
    });

    // Step 3: Verify it resumed and is ticking
    await page.evaluate(() => (window as any).__resetRafCalls());
    await page.waitForTimeout(300);
    const resumedRafCalls = await page.evaluate(() => (window as any).__getRafCalls());

    expect(resumedRafCalls).toBeGreaterThanOrEqual(5);
  });

  test('If content-visibility is not supported, the application must use IntersectionObserver to pause tasks when the element leaves the viewport', async ({ page }) => {
    const targetPath = process.env.TARGET_FILE || '';

    await page.addInitScript(() => {
      // Simulate lack of support using a Proxy on HTMLElement.prototype.style
      const originalStyleDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
      if (originalStyleDesc && originalStyleDesc.get) {
        const originalStyleGetter = originalStyleDesc.get;
        Object.defineProperty(HTMLElement.prototype, 'style', {
          get() {
            const originalStyle = originalStyleGetter.call(this);
            return new Proxy(originalStyle, {
              has(target, prop) {
                if (prop === 'contentVisibility' || prop === 'content-visibility') {
                  return false;
                }
                return Reflect.has(target, prop);
              },
              get(target, prop) {
                if (prop === 'contentVisibility' || prop === 'content-visibility') {
                  return undefined;
                }
                return Reflect.get(target, prop);
              }
            });
          },
          configurable: true
        });
      }

      // Spy on IntersectionObserver
      const OriginalIntersectionObserver = window.IntersectionObserver;
      const observerInstances: any[] = [];
      (window as any)._observerInstances = observerInstances;

      window.IntersectionObserver = class SpiedIntersectionObserver extends OriginalIntersectionObserver {
        callback: any;
        options: any;
        observedElements: Element[];

        constructor(callback: any, options: any) {
          super(callback, options);
          this.callback = callback;
          this.options = options;
          this.observedElements = [];
          observerInstances.push(this);
        }

        observe(target: Element) {
          super.observe(target);
          this.observedElements.push(target);
        }
      } as any;

      // Spy on requestAnimationFrame
      let rafCalls = 0;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        rafCalls++;
        return originalRaf.call(this, callback);
      };
      (window as any).__getRafCalls = () => rafCalls;
      (window as any).__resetRafCalls = () => { rafCalls = 0; };
    });

    await page.goto(`file://${targetPath}`);
    await page.waitForLoadState('networkidle');

    // Verify IntersectionObserver is registered and observes an element
    const observerData = await page.evaluate(() => {
      const instances = (window as any)._observerInstances || [];
      if (instances.length === 0) return null;
      const inst = instances.find((i: any) => i.observedElements.length > 0);
      if (!inst) return null;
      return {
        observedCount: inst.observedElements.length,
        observedTags: inst.observedElements.map((el: any) => el.tagName)
      };
    });

    expect(observerData).not.toBeNull();

    // Trigger IntersectionObserver callback with isIntersecting: false
    await page.evaluate(() => {
      const instances = (window as any)._observerInstances || [];
      const inst = instances.find((i: any) => i.observedElements.length > 0);
      if (inst && inst.callback) {
        const entry = {
          isIntersecting: false,
          target: inst.observedElements[0]
        };
        inst.callback([entry]);
      }
    });

    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__resetRafCalls());
    await page.waitForTimeout(300);
    const pausedRafCalls = await page.evaluate(() => (window as any).__getRafCalls());

    // Expect tasks to be paused
    expect(pausedRafCalls).toBeLessThanOrEqual(1);

    // Trigger IntersectionObserver callback with isIntersecting: true
    await page.evaluate(() => {
      const instances = (window as any)._observerInstances || [];
      const inst = instances.find((i: any) => i.observedElements.length > 0);
      if (inst && inst.callback) {
        const entry = {
          isIntersecting: true,
          target: inst.observedElements[0]
        };
        inst.callback([entry]);
      }
    });

    await page.evaluate(() => (window as any).__resetRafCalls());
    await page.waitForTimeout(300);
    const resumedRafCalls = await page.evaluate(() => (window as any).__getRafCalls());

    // Expect tasks to be running
    expect(resumedRafCalls).toBeGreaterThanOrEqual(5);
  });

});
