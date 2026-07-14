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

test.describe(`Carousel Item Effects Expectations: ${demoName}`, () => {

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

  test(`MANDATORY: The agent has defined an @keyframes block that defines states for start, center, and end.`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasKeyframes = /@keyframes\s+[\w-]+\s*\{[\s\S]*?(0%|from)[\s\S]*?50%[\s\S]*?(100%|to)[\s\S]*?\}/i.test(html);
    expect(hasKeyframes).toBe(true);
  });

  test(`MANDATORY: The agent has applied the animation to the carousel items using animation-timeline: view() or view(inline).`, async ({ page }) => {
    const animationTimeline = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller');
      if (!scroller) return 'none';
      const descendants = scroller.querySelectorAll('*');
      for (const el of descendants) {
        const timeline = (window.getComputedStyle(el) as any).animationTimeline;
        if (timeline && timeline.includes('view')) return timeline;
      }
      return 'none';
    });
    expect(animationTimeline).toContain('view');
  });

  test(`MANDATORY: The agent has used scroll-snap-type on the scroller and scroll-snap-align on the items.`, async ({ page }) => {
    const snapData = await page.evaluate(() => {
      const scroller = document.querySelector('.scroller');
      if (!scroller) return { type: 'none', align: 'none' };
      const type = window.getComputedStyle(scroller).scrollSnapType;
      
      let align = 'none';
      const descendants = scroller.querySelectorAll('*');
      for (const el of descendants) {
        const a = window.getComputedStyle(el).scrollSnapAlign;
        if (a && a !== 'none') {
          align = a;
          break;
        }
      }
      return { type, align };
    });
    expect(snapData.type).not.toBe('none');
    expect(snapData.align).not.toBe('none');
  });

  test(`MANDATORY: The implementation includes feature detection using @supports for scroll-driven animations.`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('@supports');
  });

  test(`MANDATORY: The implementation respects user preferences for reduced motion using @media (prefers-reduced-motion: no-preference).`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('prefers-reduced-motion');
  });

});
