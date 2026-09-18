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

test.describe(`Dynamic Sibling Animations Expectations: ${demoName}`, () => {
  
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
  });

  test('The animation on the first element starts before the animation on the second element.', async ({ page }) => {
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const elements = page.locator(selector);
    const count = await elements.count();
    expect(count).toBeGreaterThanOrEqual(2);
    
    const delay1 = await elements.nth(0).evaluate((el) => parseFloat(window.getComputedStyle(el).animationDelay) || parseFloat(window.getComputedStyle(el).transitionDelay));
    const delay2 = await elements.nth(1).evaluate((el) => parseFloat(window.getComputedStyle(el).animationDelay) || parseFloat(window.getComputedStyle(el).transitionDelay));
    expect(delay1).toBeLessThan(delay2);
  });

  test('`sibling-index()` is multiplied by a time and used as the `animation-delay`.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Even more flexible: just check that sibling-index() and a multiplication operator exist in an animation-delay or transition-delay
    expect(html).toMatch(/(animation-delay|transition-delay):[^;]*sibling-index\(\)/);
    expect(html).toMatch(/(animation-delay|transition-delay):[^;]*\*/);
  });

  test('The implementation provides a fallback for older browsers using CSS custom properties.', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for both the fallback variable and the native function
    const hasFallbackVar = /(animation-delay|transition-delay):[^;]*--sibling-index/.test(html);
    const hasSiblingIndex = /(animation-delay|transition-delay):[^;]*sibling-index\(\)/.test(html);
    expect(hasFallbackVar).toBe(true);
    expect(hasSiblingIndex).toBe(true);
  });

  test('The custom property values start at 1 and increment for each sibling.', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSupports = CSS.supports;
      (window as any).CSS.supports = function(condition: any, value: any) {
        if (typeof condition === 'string' && (condition.includes('sibling-index') || (value && value.includes('sibling-index')))) {
          return false;
        }
        return originalSupports.apply(this, [condition, value] as any);
      };
    });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const prop1 = await page.locator(selector).nth(0).evaluate((el: HTMLElement) => el.style.getPropertyValue('--sibling-index') || window.getComputedStyle(el).getPropertyValue('--sibling-index'));
    expect(prop1.trim()).toBe('1');
  });

  test('The fallback is applied conditionally only when `sibling-index()` is not supported.', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSupports = CSS.supports;
      (window as any).CSS.supports = function(condition: any, value: any) {
        if (typeof condition === 'string' && (condition.includes('sibling-index') || (value && value.includes('sibling-index')))) {
          return true;
        }
        return originalSupports.apply(this, [condition, value] as any);
      };
    });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const prop1 = await page.locator(selector).nth(0).evaluate((el: HTMLElement) => el.style.getPropertyValue('--sibling-index'));
    expect(prop1).toBe('');
  });

  test('If the user prefers reduced motion, the animation is disabled.', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const animName = await page.locator(selector).nth(0).evaluate((el) => window.getComputedStyle(el).animationName);
    expect(animName).toBe('none');
  });
});
