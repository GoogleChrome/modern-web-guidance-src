import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

// Test 1: CSS container-scroll-state-queries detection
test('should use CSS container-scroll-state-queries as the primary scroll state detection method', async ({ page }) => {
  await page.goto(targetUrl);

  const hasScrollStateQuery = await page.evaluate(() => {
    function searchRules(rules: CSSRuleList): boolean {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.cssText && rule.cssText.includes('scroll-state')) {
          return true;
        }
        if ('cssRules' in rule && rule.cssRules) {
          if (searchRules(rule.cssRules as CSSRuleList)) {
            return true;
          }
        }
      }
      return false;
    }

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        if (sheet.cssRules && searchRules(sheet.cssRules)) {
          return true;
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }
    return false;
  });

  expect(hasScrollStateQuery).toBe(true);
});

// Test 2: Fallback show/hide behavior on scroll when CSS scroll-state is unsupported
test('should fall back and show/hide the button on scroll when container-scroll-state-queries is not supported', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    CSS.supports = function (property: string, value?: string) {
      if (property === 'container-type' && value === 'scroll-state') {
        return false;
      }
      if (arguments.length === 1 && typeof property === 'string' && property.includes('container-type') && property.includes('scroll-state')) {
        return false;
      }
      return originalSupports.apply(this, arguments as any);
    };

    (window as any).__scrollListeners = [];
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'scroll') {
        (window as any).__scrollListeners.push({ target: this, listener, options });
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  });

  await page.goto(targetUrl);

  // Disable smooth scrolling to make it instant, and scroll down
  await page.evaluate(() => {
    const findScroller = () => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return el as HTMLElement;
        }
      }
      return (document.querySelector('.scroller') || document.body) as HTMLElement;
    };
    const scroller = findScroller();
    scroller.style.scrollBehavior = 'auto';
    scroller.scrollTop = 200;
  });

  // Wait dynamically for the floating element to be visible
  await page.waitForFunction(() => {
    const findFloatingElement = () => {
      const selectors = ['.back-to-top', '#backToTop', '[class*="back-to-top"]'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      const elements = Array.from(document.querySelectorAll('a, button, div'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('top')) {
          return el;
        }
      }
      return null;
    };

    const el = findFloatingElement();
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && parseFloat(style.opacity || '0') > 0.5;
  }, null, { timeout: 2000 });

  const result = await page.evaluate(() => {
    const findFloatingElement = () => {
      const selectors = ['.back-to-top', '#backToTop', '[class*="back-to-top"]'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      const elements = Array.from(document.querySelectorAll('a, button, div'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('top')) {
          return el;
        }
      }
      return null;
    };

    const el = findFloatingElement();
    if (!el) return { isVisible: false, scrollListenerCount: 0 };
    const style = window.getComputedStyle(el);
    const isVisible = style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.5;
    const scrollListenerCount = ((window as any).__scrollListeners || []).length;
    return { isVisible, scrollListenerCount };
  });

  expect(result.isVisible && result.scrollListenerCount === 0).toBe(true);
});

// Test 3a: Fallback uses IntersectionObserver when unsupported
test('should use IntersectionObserver for fallback scroll state detection when unsupported', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    CSS.supports = function (property: string, value?: string) {
      if (property === 'container-type' && value === 'scroll-state') {
        return false;
      }
      if (arguments.length === 1 && typeof property === 'string' && property.includes('container-type') && property.includes('scroll-state')) {
        return false;
      }
      return originalSupports.apply(this, arguments as any);
    };

    (window as any).__intersectionObserverCalls = 0;
    const OriginalObserver = window.IntersectionObserver;
    (window as any).IntersectionObserver = class SpyIntersectionObserver extends OriginalObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        (window as any).__intersectionObserverCalls++;
        super(callback, options);
      }
    };
  });

  await page.goto(targetUrl);

  const observerCalls = await page.evaluate(() => (window as any).__intersectionObserverCalls || 0);
  expect(observerCalls).toBeGreaterThan(0);
});

// Test 3b: Fallback does NOT use continuous scroll event listeners for scroll detection
test('should not use continuous scroll event listeners for scroll state detection', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    CSS.supports = function (property: string, value?: string) {
      if (property === 'container-type' && value === 'scroll-state') {
        return false;
      }
      if (arguments.length === 1 && typeof property === 'string' && property.includes('container-type') && property.includes('scroll-state')) {
        return false;
      }
      return originalSupports.apply(this, arguments as any);
    };

    (window as any).__scrollListeners = [];
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
      if (type === 'scroll') {
        (window as any).__scrollListeners.push({ target: this, listener, options });
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  });

  await page.goto(targetUrl);

  const scrollListenerCount = await page.evaluate(() => ((window as any).__scrollListeners || []).length);
  expect(scrollListenerCount).toBe(0);
});

// Test 4: Sentinel elements used for fallback must have zero dimensions or use absolute positioning
test('should style fallback sentinel elements to have zero dimensions or use absolute positioning', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSupports = CSS.supports;
    CSS.supports = function (property: string, value?: string) {
      if (property === 'container-type' && value === 'scroll-state') {
        return false;
      }
      if (arguments.length === 1 && typeof property === 'string' && property.includes('container-type') && property.includes('scroll-state')) {
        return false;
      }
      return originalSupports.apply(this, arguments as any);
    };

    (window as any).__observedElements = [];
    const OriginalObserver = window.IntersectionObserver;
    (window as any).IntersectionObserver = class SpyIntersectionObserver extends OriginalObserver {
      observe(target: Element) {
        if (!(window as any).__observedElements) {
          (window as any).__observedElements = [];
        }
        (window as any).__observedElements.push(target);
        return super.observe(target);
      }
    };
  });

  await page.goto(targetUrl);

  const sentinelStyles = await page.evaluate(() => {
    const targets = (window as any).__observedElements || [];
    if (targets.length === 0) {
      return null;
    }
    return targets.map((el: Element) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        width: style.width,
        height: style.height,
        position: style.position,
        rectWidth: rect.width,
        rectHeight: rect.height,
      };
    });
  });

  expect(sentinelStyles).not.toBeNull();

  const isValidSentinel = sentinelStyles!.some((style: any) => {
    const hasZeroDimensions = (
      style.width === '0px' || style.height === '0px' ||
      style.rectWidth === 0 || style.rectHeight === 0
    );
    const hasAbsolutePosition = style.position === 'absolute' || style.position === 'fixed';
    return hasZeroDimensions || hasAbsolutePosition;
  });

  expect(isValidSentinel).toBe(true);
});

// Test 5: Floating element should be hidden by default at the top of the container
test('should hide the floating element by default at the top of the container', async ({ page }) => {
  await page.goto(targetUrl);

  const defaultState = await page.evaluate(() => {
    const findFloatingElement = () => {
      const selectors = ['.back-to-top', '#backToTop', '[class*="back-to-top"]'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      const elements = Array.from(document.querySelectorAll('a, button, div'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('top')) {
          return el;
        }
      }
      return null;
    };

    const el = findFloatingElement();
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      visibility: style.visibility,
      display: style.display,
      opacity: parseFloat(style.opacity || '1'),
    };
  });

  expect(defaultState).not.toBeNull();
  expect(defaultState!.visibility === 'hidden' || defaultState!.display === 'none').toBe(true);
});

// Test 6: Implementation uses transitionable visibility to handle entry/exit animations
test('should use transitionable visibility to handle entry/exit animations and avoid tab order when hidden', async ({ page }) => {
  await page.goto(targetUrl);

  const transitionProperties = await page.evaluate(() => {
    const findFloatingElement = () => {
      const selectors = ['.back-to-top', '#backToTop', '[class*="back-to-top"]'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      const elements = Array.from(document.querySelectorAll('a, button, div'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('top')) {
          return el;
        }
      }
      return null;
    };

    const el = findFloatingElement();
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
    };
  });

  expect(transitionProperties).not.toBeNull();

  const hasVisibilityTransition =
    transitionProperties!.transitionProperty.includes('visibility') ||
    transitionProperties!.transitionProperty === 'all';

  const hasNonZeroDuration =
    transitionProperties!.transitionDuration !== '0s' &&
    transitionProperties!.transitionDuration !== '';

  expect(hasVisibilityTransition && hasNonZeroDuration).toBe(true);
});
