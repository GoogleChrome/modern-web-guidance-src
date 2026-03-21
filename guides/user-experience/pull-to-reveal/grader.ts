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

test.describe(`Pull-to-Reveal Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Only one element specifies scroll-initial-target: nearest`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const exactCssDeclarations = html.match(/scroll-initial-target\s*:\s*nearest\s*;/g) || [];
    expect(exactCssDeclarations.length).toBe(1);
  });

  test(`Progressive enhancement fallback evaluates native CSS capability`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('!CSS.supports("scroll-initial-target", "nearest")');
  });

  test(`Fallback script uses scrollIntoView with instant behavior and block start`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/scrollIntoView\(\s*\{\s*behavior\s*:\s*['"]instant['"]\s*,\s*block\s*:\s*['"]start['"]\s*\}\s*\)/);
  });

  test(`Fallback script executes no later than DOMContentLoaded`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('DOMContentLoaded');
  });

  test(`Implementation does not rely on setTimeout for initial scroll`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('setTimeout');
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

  test(`Scroll container has overflow-y auto or scroll`, async ({ page }) => {
    const hasOverflow = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll';
      });
    });
    expect(hasOverflow).toBe(true);
  });

  test(`Scroll container has mandatory snapping`, async ({ page }) => {
    const hasMandatorySnapping = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        return style.scrollSnapType.includes('mandatory');
      });
    });
    expect(hasMandatorySnapping).toBe(true);
  });

  test(`Hidden element has scroll-snap-align start`, async ({ page }) => {
    const snapAlignStart = await page.evaluate(() => {
      const container = Array.from(document.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && style.scrollSnapType.includes('mandatory');
      });
      if (!container) return false;
      const firstChild = container.firstElementChild;
      if (!firstChild) return false;
      const style = window.getComputedStyle(firstChild);
      return style.scrollSnapAlign.includes('start');
    });
    expect(snapAlignStart).toBe(true);
  });

  test(`Main content element has scroll-snap-align start`, async ({ page }) => {
    const snapAlignStart = await page.evaluate(() => {
      const container = Array.from(document.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && style.scrollSnapType.includes('mandatory');
      });
      if (!container) return false;
      const firstChild = container.firstElementChild;
      const mainContent = firstChild?.nextElementSibling;
      if (!mainContent) return false;
      const style = window.getComputedStyle(mainContent);
      return style.scrollSnapAlign.includes('start');
    });
    expect(snapAlignStart).toBe(true);
  });
});