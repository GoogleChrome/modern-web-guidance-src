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

  // Functional/Browser-based Tests
  test(`The .target element MUST have the 'scroll-initial-target: nearest' CSS property applied`, async ({ page }) => {
    const hasProperty = await page.evaluate(() => {
      const target = document.querySelector('.target') as HTMLElement;
      if (!target) return false;
      
      const style = window.getComputedStyle(target) as any;
      if (style.scrollInitialTarget === 'nearest' || style['scroll-initial-target'] === 'nearest') return true;
      
      if (target.style.getPropertyValue('scroll-initial-target') === 'nearest') return true;
      
      return false;
    });

    // Fallback to regex on HTML if browser check fails (likely due to support)
    const hasPropertyRegex = html.match(/[\s{;]scroll-initial-target\s*:\s*nearest\s*[;}]/);

    expect(hasProperty || !!hasPropertyRegex).toBe(true);
  });

  test(`Only a single element should have the class '.target'`, async ({ page }) => {
    const targetCount = await page.evaluate(() => document.querySelectorAll('.target').length);
    expect(targetCount).toBe(1);
  });

  test(`The progressive enhancement fallback MUST evaluate native CSS capability using 'CSS.supports'`, async ({ page }) => {
    const calls = await page.evaluate(() => (window as any).__cssSupportsCalls);
    const checked = calls.some((c: any) => 
      (c.property === 'scroll-initial-target' && c.value === 'nearest') ||
      (c.condition && c.condition.includes('scroll-initial-target') && c.condition.includes('nearest'))
    );
    expect(checked).toBe(true);
  });

  test(`The fallback script MUST execute no later than 'DOMContentLoaded' or at end of body`, async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollIntoViewCalls);
    const loadTime = await page.evaluate(() => (window as any).__loadTime);

    expect(fallbackCalls.length).toBeGreaterThan(0);
    const fallbackTime = fallbackCalls[0].time;

    expect(fallbackTime).toBeLessThan(loadTime);
  });

  test(`The fallback script MUST use 'behavior: instant' for scrollIntoView`, async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollIntoViewCalls);
    expect(fallbackCalls.length).toBeGreaterThan(0);
    const call = fallbackCalls.find((c: any) => c.className.includes('target')) || fallbackCalls[0];
    expect(call.options.behavior).toBe('instant');
  });

  test(`The fallback script MUST NOT use 'behavior: smooth'`, async ({ page }) => {
    const fallbackCalls = await page.evaluate(() => (window as any).__scrollIntoViewCalls);
    for (const call of fallbackCalls) {
      expect(call.options.behavior).not.toBe('smooth');
    }
  });

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

      (window as any).__scrollIntoViewCalls = [];
      const originalScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options: any) {
        (window as any).__scrollIntoViewCalls.push({
          options,
          time: performance.now(),
          tagName: this.tagName,
          className: this.className,
          id: this.id
        });
        return originalScrollIntoView.apply(this, arguments as any);
      };

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

  // Browser Assertions
  test(`The implementation MUST include an ancestor scroll container with overflow scrolling configured`, async ({ page }) => {
    const hasScrollContainer = await page.evaluate(() => {
      // Find the target element using typical identifiers used in the guides
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

  test(`Media elements within the scroll container MUST have explicit dimensions applied`, async ({ page }) => {
    const mediaHaveDimensions = await page.evaluate(() => {
      const target = document.querySelector('.target, [style*="scroll-initial-target"], #target');
      if (!target) return false;

      // Identify the scroll container
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
        // Check for width and height attributes or explicit inline styles
        const hasWidth = img.hasAttribute('width') || (img.style.width && img.style.width !== 'auto');
        const hasHeight = img.hasAttribute('height') || (img.style.height && img.style.height !== 'auto');
        const style = window.getComputedStyle(img);
        const hasAspectRatio = style.aspectRatio !== 'auto';
        
        // Explicit dimensions require width AND (height OR aspect-ratio)
        return hasWidth && (hasHeight || hasAspectRatio);
      });
    });
    expect(mediaHaveDimensions).toBe(true);
  });
});
