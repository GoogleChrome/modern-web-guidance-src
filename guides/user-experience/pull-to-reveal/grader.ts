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

// Tests
test.describe(`Pull-to-Reveal Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Progressive enhancement JavaScript fallback MUST evaluate native CSS capability`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasSupportsCheck = html.includes('CSS.supports("scroll-initial-target", "nearest")') ||
                             html.includes("CSS.supports('scroll-initial-target', 'nearest')") ||
                             html.includes('CSS.supports(`scroll-initial-target`, `nearest`)');
    expect(hasSupportsCheck).toBe(true);
  });

  test(`Fallback script MUST use element.scrollIntoView({ behavior: 'instant', block: 'start' })`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const regex = /scrollIntoView\s*\(\s*\{\s*behavior\s*:\s*['"`]instant['"`]\s*,\s*block\s*:\s*['"`]start['"`]\s*\}\s*\)/;
    expect(regex.test(html)).toBe(true);
  });

  test(`Fallback script MUST execute no later than DOMContentLoaded`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasDOMContentLoaded = html.includes('DOMContentLoaded');
    expect(hasDOMContentLoaded).toBe(true);
  });

  test(`Implementation MUST NOT rely on JavaScript to calculate initial scroll offset blindly`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    if (html.includes('scrollIntoView')) {
      const hasSupports = html.includes('CSS.supports');
      expect(hasSupports).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  test(`The scroll-initial-target property MUST be applied to only one element`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    let count = 0;
    if (styleMatches) {
      for (const style of styleMatches) {
        const propertyMatches = style.match(/scroll-initial-target\s*:\s*nearest/g);
        if (propertyMatches) {
          count += propertyMatches.length;
        }
      }
    }
    const inlineMatches = html.match(/style\s*=\s*['"][^'"]*scroll-initial-target\s*:\s*nearest[^'"]*['"]/g);
    if (inlineMatches) {
      count += inlineMatches.length;
    }
    expect(count).toBe(1);
  });

  // Setup browser testing
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

  // Browser assertions
  test(`Ancestor scroll container MUST be configured with scrolling and mandatory snapping`, async ({ page }) => {
    const containers = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.filter(el => {
        const style = window.getComputedStyle(el);
        const hasScroll = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        const hasSnap = style.scrollSnapType.includes('y') && style.scrollSnapType.includes('mandatory');
        return hasScroll && hasSnap;
      }).length;
    });
    expect(containers).toBeGreaterThan(0);
  });

  test(`Main content element MUST have scroll-snap-align: start and scroll-initial-target: nearest`, async ({ page }) => {
    const hasMainSnap = await page.evaluate(() => {
      let mainSelector = null;
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '');
      for (const styleText of styles) {
        const regex = /(?:^|\})([^{}]+)\s*\{[^{}]*scroll-initial-target\s*:\s*nearest/g;
        let match;
        while ((match = regex.exec(styleText)) !== null) {
          let sel = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
          if (sel) {
            mainSelector = sel;
            break;
          }
        }
        if (mainSelector) break;
      }

      if (!mainSelector) {
        mainSelector = '[style*="scroll-initial-target"]';
      }

      const mainElement = document.querySelector(mainSelector);
      if (!mainElement) return false;

      const style = window.getComputedStyle(mainElement);
      return style.scrollSnapAlign.includes('start');
    });
    expect(hasMainSnap).toBe(true);
  });

  test(`A hidden element MUST be included as one of the first descendants with scroll-snap-align: start`, async ({ page }) => {
    const hasHiddenSnap = await page.evaluate(() => {
      let mainSelector = null;
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '');
      for (const styleText of styles) {
        const regex = /(?:^|\})([^{}]+)\s*\{[^{}]*scroll-initial-target\s*:\s*nearest/g;
        let match;
        while ((match = regex.exec(styleText)) !== null) {
          let sel = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
          if (sel) {
            mainSelector = sel;
            break;
          }
        }
        if (mainSelector) break;
      }

      if (!mainSelector) {
        mainSelector = '[style*="scroll-initial-target"]';
      }

      const mainElement = document.querySelector(mainSelector);
      if (!mainElement) return false;

      const previousElement = mainElement.previousElementSibling;
      if (!previousElement) return false;

      const style = window.getComputedStyle(previousElement);
      return style.scrollSnapAlign.includes('start');
    });
    expect(hasHiddenSnap).toBe(true);
  });
});
