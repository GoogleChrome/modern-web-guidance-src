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

  test('Exactly one element should have scroll-initial-target property', async () => {
    const matches = html.match(/scroll-initial-target\s*:\s*nearest/g);
    expect(matches?.length).toBe(1);
  });

  test('The fallback must check for CSS support using CSS.supports', async () => {
    const supportsRegex = /CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/;
    expect(html).toMatch(supportsRegex);
  });

  test('The fallback must use behavior: instant in scrollIntoView', async () => {
    const behaviorRegex = /scrollIntoView\(\s*\{[^}]*behavior\s*:\s*['"]instant['"][^}]*\}\s*\)/;
    expect(html).toMatch(behaviorRegex);
  });

  test('The fallback must use block: start in scrollIntoView', async () => {
    const blockRegex = /scrollIntoView\(\s*\{[^}]*block\s*:\s*['"]start['"][^}]*\}\s*\)/;
    expect(html).toMatch(blockRegex);
  });

  test('The fallback must execute on DOMContentLoaded or earlier', async () => {
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

  test('The scroll container must have overflow-y and mandatory snapping', async ({ page }) => {
    const containerStyle = await page.evaluate(() => {
      const findFeatureElements = () => {
        const elements = Array.from(document.querySelectorAll('*'));
        const snapPoints = elements.filter(el => {
          const style = window.getComputedStyle(el);
          return style.scrollSnapAlign === 'start' || style.scrollSnapAlign.startsWith('start ');
        });
        if (snapPoints.length < 2) return null;
        const target = snapPoints[1];
        let container = target.parentElement;
        while (container) {
          const style = window.getComputedStyle(container);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return { el: container, style };
          }
          container = container.parentElement;
        }
        const htmlStyle = window.getComputedStyle(document.documentElement);
        if (htmlStyle.overflowY === 'auto' || htmlStyle.overflowY === 'scroll') {
          return { el: document.documentElement, style: htmlStyle };
        }
        return null;
      };

      const result = findFeatureElements();
      if (!result) return null;
      return {
        overflowY: result.style.overflowY,
        scrollSnapType: result.style.scrollSnapType
      };
    });

    expect(containerStyle).not.toBeNull();
    expect(['auto', 'scroll']).toContain(containerStyle?.overflowY);
    expect(containerStyle?.scrollSnapType).toMatch(/y mandatory/);
  });

  test('The hidden element must have scroll-snap-align: start', async ({ page }) => {
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

  test('The main content element must have scroll-snap-align: start', async ({ page }) => {
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

  test('Initial scroll position must be at the main content element', async ({ page }) => {
    // Wait for any potential scrolling to finish
    await page.waitForTimeout(500);
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
        const htmlStyle = window.getComputedStyle(document.documentElement);
        if (htmlStyle.overflowY === 'auto' || htmlStyle.overflowY === 'scroll') {
          container = document.documentElement;
        }
      }
      
      if (!container) return null;

      const cRect = container === document.documentElement ? { top: 0, left: 0 } : container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      
      // The top of the target should be at the top of the container's visible area.
      // container.clientTop is the border width.
      const topDiff = Math.abs(tRect.top - (cRect.top + (container === document.documentElement ? 0 : container.clientTop)));
      
      return {
        scrollTop: container.scrollTop,
        topDiff,
        hasScrolled: container.scrollTop > 0 || window.scrollY > 0
      };
    });

    expect(scrollStatus).not.toBeNull();
    expect(scrollStatus?.hasScrolled).toBe(true);
    expect(scrollStatus?.topDiff).toBeLessThan(5);
  });
});
