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
      const elements = document.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.children.length >= 2) {
          return {
            overflowY: style.overflowY,
            scrollSnapType: style.scrollSnapType
          };
        }
      }
      return null;
    });

    expect(containerStyle).not.toBeNull();
    expect(['auto', 'scroll']).toContain(containerStyle?.overflowY);
    expect(containerStyle?.scrollSnapType).toMatch(/y mandatory/);
  });

  test('The hidden element (first descendant) must have scroll-snap-align: start', async ({ page }) => {
    const snapAlign = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.children.length >= 2) {
          return window.getComputedStyle(el.children[0]).scrollSnapAlign;
        }
      }
      return null;
    });
    expect(snapAlign).toBe('start');
  });

  test('The main content element (second descendant) must have scroll-snap-align: start', async ({ page }) => {
    const snapAlign = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.children.length >= 2) {
          return window.getComputedStyle(el.children[1]).scrollSnapAlign;
        }
      }
      return null;
    });
    expect(snapAlign).toBe('start');
  });

  test('Initial scroll position must be at the main content element', async ({ page }) => {
    // Wait for any potential scrolling to finish
    await page.waitForTimeout(500);
    const scrollStatus = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of Array.from(elements)) {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.children.length >= 2) {
          const container = el as HTMLElement;
          const target = el.children[1] as HTMLElement;
          const cRect = container.getBoundingClientRect();
          const tRect = target.getBoundingClientRect();
          
          // The top of the target should be at the top of the container's visible area.
          // container.clientTop is the border width.
          const topDiff = Math.abs(tRect.top - (cRect.top + container.clientTop));
          
          return {
            scrollTop: container.scrollTop,
            topDiff,
            hasScrolled: container.scrollTop > 0
          };
        }
      }
      return null;
    });

    expect(scrollStatus).not.toBeNull();
    expect(scrollStatus?.hasScrolled).toBe(true);
    // Use a small margin of error for different browsers/renderings
    expect(scrollStatus?.topDiff).toBeLessThan(5);
  });
});
