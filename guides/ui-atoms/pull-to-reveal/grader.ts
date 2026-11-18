import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe('Pull-to-Reveal Grader', () => {
  const html = fs.readFileSync(filePath, 'utf-8');

  // --- Static Analysis Tests ---

  test('Exactly one element has scroll-initial-target property', async () => {
    const matches = html.match(/scroll-initial-target\s*:\s*nearest/g);
    expect(matches?.length).toBe(1);
  });

  test('The fallback checks for CSS support using CSS.supports', async () => {
    const supportsRegex = /CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/;
    expect(html).toMatch(supportsRegex);
  });

  test('The fallback uses behavior: instant when scrolling', async () => {
    const behaviorRegex = /behavior\s*:\s*['"]instant['"]/;
    expect(html).toMatch(behaviorRegex);
  });

  test('The fallback executes on DOMContentLoaded or earlier', async () => {
    // Check that it doesn't use window.onload and instead uses DOMContentLoaded or immediate execution
    expect(html).not.toMatch(/window\.onload/);
    expect(html).toMatch(/DOMContentLoaded|addEventListener|querySelector/);
  });

  // --- Browser-based Tests ---

  test.beforeEach(async ({ page }) => {
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

  test('The scroll container is configured for vertical scrolling and snapping', async ({ page }) => {
    const containerStyle = await page.evaluate(() => {
      const findFeatureElements = () => {
        const elements = Array.from(document.querySelectorAll('*'));
        const snapPoints = elements.filter(el => {
          const style = window.getComputedStyle(el);
          return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
        });
        if (snapPoints.length < 2) return null;
        const target = snapPoints[1];
        let container: HTMLElement | null = target.parentElement;
        while (container) {
          const style = window.getComputedStyle(container);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return { el: container, style };
          }
          container = container.parentElement;
        }
        const htmlStyle = window.getComputedStyle(document.documentElement);
        return { el: document.documentElement, style: htmlStyle };
      };

      const result = findFeatureElements();
      if (!result) return null;
      return {
        overflowY: result.style.overflowY,
        scrollSnapType: result.style.scrollSnapType
      };
    });

    expect(containerStyle).not.toBeNull();
    expect(containerStyle?.scrollSnapType).toMatch(/^(y|block)\s+mandatory$/);
  });

  test('The hidden element has scroll-snap-align: start', async ({ page }) => {
    const snapAlign = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const snapPoints = elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
      });
      if (snapPoints.length < 2) return null;
      return window.getComputedStyle(snapPoints[0]).scrollSnapAlign;
    });
    expect(snapAlign).toBe('start');
  });

  test('The main content element has scroll-snap-align: start', async ({ page }) => {
    const snapAlign = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const snapPoints = elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
      });
      if (snapPoints.length < 2) return null;
      return window.getComputedStyle(snapPoints[1]).scrollSnapAlign;
    });
    expect(snapAlign).toBe('start');
  });

  test('Initial scroll position is at the main content element', async ({ page }) => {
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        if (window.scrollY > 0 || root.scrollTop > 0) return true;
        const snapPoints = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
        });
        if (snapPoints.length < 2) return false;
        let container: HTMLElement | null = snapPoints[1].parentElement;
        while (container) {
          const style = window.getComputedStyle(container);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && container.scrollTop > 0) {
            return true;
          }
          container = container.parentElement;
        }
        return false;
      });
    }, { timeout: 2000 }).toBe(true);

    const scrollStatus = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const snapPoints = elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
      });
      if (snapPoints.length < 2) return null;
      
      const target = snapPoints[1];
      let container: HTMLElement | null = target.parentElement;
      while (container) {
        const style = window.getComputedStyle(container);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          break;
        }
        container = container.parentElement;
      }
      
      if (!container) {
        container = (document.scrollingElement || document.documentElement) as HTMLElement;
      }

      const isRootContainer = container === document.documentElement || container === document.scrollingElement;
      const cRect = isRootContainer
        ? { top: 0, left: 0 }
        : container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      
      const clientTop = isRootContainer
        ? 0
        : container.clientTop;
      const topDiff = Math.abs(tRect.top - (cRect.top + clientTop));
      
      const scrollY = isRootContainer ? (window.scrollY || container.scrollTop) : container.scrollTop;
      return {
        scrollTop: scrollY,
        topDiff,
        hasScrolled: scrollY > 0
      };
    });

    expect(scrollStatus).not.toBeNull();
    expect(scrollStatus?.hasScrolled).toBe(true);
    expect(scrollStatus?.topDiff).toBeLessThan(5);
  });
});
