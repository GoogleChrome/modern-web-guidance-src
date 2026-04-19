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

  test(`MANDATORY: The agent has defined an @keyframes block that defines states for start, center, and end.`, async ({ page }) => {
    // We check if there is any keyframe rule that has 0%, 50%, and 100% (or equivalent from/to)
    // But since reading keyframes via CSSOM is complex, we can check file content as a fallback or use a simplified CSSOM check.
    // Let's try to check file content for '@keyframes' and percentages or just use CSSOM if we can.
    // Let's use CSSOM to find the keyframes rule.
    const hasKeyframes = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE) {
              const kfRule = rule as CSSKeyframesRule;
              const texts = Array.from(kfRule.cssRules).flatMap(r => (r as CSSKeyframeRule).keyText.split(',').map(s => s.trim()));
              // Check if it has something for start (0% or from), center (50%), and end (100% or to)
              const hasStart = texts.includes('0%') || texts.includes('from');
              const hasCenter = texts.includes('50%');
              const hasEnd = texts.includes('100%') || texts.includes('to');
              if (hasStart && hasCenter && hasEnd) return true;

            }
          }
        } catch (e) {
          // Ignore CORS errors
        }
      }
      return false;
    });
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
