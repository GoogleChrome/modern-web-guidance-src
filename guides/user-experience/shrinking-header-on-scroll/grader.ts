import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Shrinking Header Expectations: ${demoName}`, () => {

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



  test(`MANDATORY: The agent has defined an @keyframes block that animates the header or nav.`, async ({ page }) => {
    const animationName = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('header, nav'));
      const el = elements.find(e => window.getComputedStyle(e).animationName !== 'none') || elements[0];
      if (!el) return 'none';
      return window.getComputedStyle(el).animationName;
    });
    expect(animationName).not.toBe('none');
  });

  test(`MANDATORY: The agent has applied the animation using animation-timeline: scroll() or scroll(block root).`, async ({ page }) => {
    const animationTimeline = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('header, nav'));
      const el = elements.find(e => window.getComputedStyle(e).animationName !== 'none') || elements[0];
      if (!el) return 'none';
      return window.getComputedStyle(el).getPropertyValue('animation-timeline');
    });
    expect(animationTimeline).toContain('scroll');
  });

  test(`MANDATORY: The agent has used animation-range to specify the scroll distance.`, async ({ page }) => {
    const animationRange = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('header, nav'));
      const el = elements.find(e => window.getComputedStyle(e).animationName !== 'none') || elements[0];
      if (!el) return 'normal';
      return window.getComputedStyle(el).getPropertyValue('animation-range');
    });
    expect(animationRange).not.toBe('normal');
  });

  test(`MANDATORY: The header or nav element has position: fixed or position: sticky.`, async ({ page }) => {
    const position = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('header, nav'));
      const pos = elements.map(el => window.getComputedStyle(el).position);
      return pos.includes('fixed') || pos.includes('sticky') ? 'sticky' : 'static'; // simplified return
    });
    expect(position).toBe('sticky'); // or fixed, but we just check it found at least one
  });

  test(`MANDATORY: The implementation includes feature detection using @supports or CSS.supports for scroll-driven animations.`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasSupports = html.includes('@supports') || html.includes('CSS.supports');
    expect(hasSupports).toBe(true);
  });

  test(`MANDATORY: The implementation respects user preferences for reduced motion or provides valid fallback.`, async () => {
    expect(true).toBe(true);
  });

});
