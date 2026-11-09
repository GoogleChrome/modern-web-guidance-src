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

test.describe(`Scroll Initial Target Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    // Inject spies and mocks before page loads
    await page.addInitScript(() => {
      (window as any).__cssSupportsCalls = [];
      const originalSupports = CSS.supports;
      CSS.supports = function(propertyOrCondition: string, value?: string) {
        if (value !== undefined) {
          (window as any).__cssSupportsCalls.push({ property: propertyOrCondition, value });
          if (propertyOrCondition === 'scroll-initial-target') return false;
        } else {
          (window as any).__cssSupportsCalls.push({ condition: propertyOrCondition });
          if (propertyOrCondition.includes('scroll-initial-target')) return false;
        }
        return originalSupports.apply(this, arguments as any);
      };

      (window as any).__scrollCalls = [];
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options: any) {
        (window as any).__scrollCalls.push({
          type: 'scrollIntoView',
          options,
          time: performance.now(),
          tagName: this.tagName,
          className: this.className,
          id: this.id
        });
        return originalScrollIntoView.apply(this, arguments as any);
      };

      const originalScrollTo = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function(...args: any[]) {
        (window as any).__scrollCalls.push({
          type: 'scrollTo',
          options: args[0],
          time: performance.now(),
          tagName: this.tagName,
          className: this.className,
          id: this.id
        });
        return originalScrollTo.apply(this, args as any);
      };

      const scrollTopDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
      if (scrollTopDesc && scrollTopDesc.set) {
        const origSet = scrollTopDesc.set;
        Object.defineProperty(Element.prototype, 'scrollTop', {
          set(val: number) {
            (window as any).__scrollCalls.push({
              type: 'scrollTop',
              value: val,
              time: performance.now(),
              tagName: this.tagName,
              className: this.className,
              id: this.id
            });
            return origSet.call(this, val);
          },
          get() {
            return scrollTopDesc.get?.call(this);
          }
        });
      }

      (window as any).__domContentLoadedTime = null;
      document.addEventListener('DOMContentLoaded', () => {
        (window as any).__domContentLoadedTime = performance.now();
      });

      (window as any).__loadTime = null;
      window.addEventListener('load', () => {
        (window as any).__loadTime = performance.now();
      });
    });

    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('The .target element has the scroll-initial-target: nearest CSS property applied', async ({ page }) => {
    const hasProperty = await page.evaluate(() => {
      const target = document.querySelector('.target') as HTMLElement;
      if (!target) return false;

      const style = window.getComputedStyle(target) as any;
      if (style.scrollInitialTarget === 'nearest' || style['scroll-initial-target'] === 'nearest') return true;

      if (target.style.getPropertyValue('scroll-initial-target') === 'nearest') return true;

      return false;
    });

    const hasPropertyRegex = /[\s{;]scroll-initial-target\s*:\s*nearest\s*[;}]/.test(html);

    expect(hasProperty || hasPropertyRegex).toBe(true);
  });

  test('Only a single element has the class target', async ({ page }) => {
    const targetCount = await page.evaluate(() => document.querySelectorAll('.target').length);
    expect(targetCount).toBe(1);
  });

  test('The progressive enhancement fallback evaluates native CSS capability using CSS.supports', async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__cssSupportsCalls || []);
    const checked = calls.some((c: any) =>
      (c.property === 'scroll-initial-target' && c.value === 'nearest') ||
      (c.condition && c.condition.includes('scroll-initial-target') && c.condition.includes('nearest'))
    );
    expect(checked).toBe(true);
  });

  test('The fallback script executes no later than DOMContentLoaded or at end of body', async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollCalls || []);
    const dclEnd = await page.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).domContentLoadedEventEnd);

    expect(fallbackCalls.length).toBeGreaterThan(0);
    const fallbackTime = fallbackCalls[0].time;

    expect(fallbackTime).toBeLessThanOrEqual(dclEnd);
  });

  test('The fallback script uses instant scrolling to bring the target into view', async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollCalls || []);
    expect(fallbackCalls.length).toBeGreaterThan(0);
    const call = fallbackCalls[0];
    if (call.type === 'scrollIntoView' || call.type === 'scrollTo') {
      const behavior = typeof call.options === 'object' ? call.options?.behavior : undefined;
      expect(behavior === 'instant' || behavior === undefined).toBe(true);
    } else {
      expect(call.type).toBe('scrollTop');
    }
  });

  test('The fallback script does not use smooth scrolling', async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollCalls || []);
    expect(fallbackCalls.length).toBeGreaterThan(0);
    for (const call of fallbackCalls) {
      if (call.options && typeof call.options === 'object') {
        expect(call.options.behavior).not.toBe('smooth');
      }
    }
  });

  test('The implementation includes an ancestor scroll container with overflow scrolling configured', async ({ page }) => {
    const hasScrollContainer = await page.evaluate(() => {
      const target = document.querySelector('.target, [style*="scroll-initial-target"], #target');
      if (!target) return false;

      let parent = target.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const hasOverflow = (val: string) => val === 'auto' || val === 'scroll';
        if (hasOverflow(style.overflow) || hasOverflow(style.overflowY) || hasOverflow(style.overflowX)) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    });
    expect(hasScrollContainer).toBe(true);
  });

  test('Media elements within the scroll container have explicit dimensions applied', async ({ page }) => {
    const mediaHaveDimensions = await page.evaluate(() => {
      const target = document.querySelector('.target, [style*="scroll-initial-target"], #target');
      if (!target) return false;

      let container: HTMLElement | null = target.parentElement;
      while (container) {
        const style = window.getComputedStyle(container);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
        container = container.parentElement;
      }

      const searchRoot = container || document.body;
      const images = searchRoot.querySelectorAll('img');

      if (images.length === 0) return true;

      return Array.from(images).every(img => {
        const hasWidth = img.hasAttribute('width') || (img.style.width && img.style.width !== 'auto');
        const hasHeight = img.hasAttribute('height') || (img.style.height && img.style.height !== 'auto');
        const style = window.getComputedStyle(img);
        const hasAspectRatio = style.aspectRatio !== 'auto';

        return hasWidth && (hasHeight || hasAspectRatio);
      });
    });
    expect(mediaHaveDimensions).toBe(true);
  });
});
