import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Stack Drill-Down Navigation Grader: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    // Intercept navigation requests to serve local assets
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

  test('Stack container uses correct scroll snapping styles', async ({ page }) => {
    const stack = page.locator('.Stack');
    await expect(stack).toHaveCSS('scroll-snap-type', /x mandatory/);
    await expect(stack).toHaveCSS('overflow-x', 'auto');
  });

  test('Parallax animation applies appropriate translateX offset (>= 75%)', async ({ page }) => {
    const transformPercent = await page.evaluate(() => {
      function findKeyframesRule(rules: CSSRuleList, name: string): CSSKeyframesRule | null {
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE && (rule as CSSKeyframesRule).name === name) {
            return rule as CSSKeyframesRule;
          }
          if ('cssRules' in rule && (rule as any).cssRules) {
            const found = findKeyframesRule((rule as any).cssRules, name);
            if (found) return found;
          }
        }
        return null;
      }

      for (const sheet of document.styleSheets) {
        try {
          const rule = findKeyframesRule(sheet.cssRules, 'parallax');
          if (rule) {
            for (const kf of rule.cssRules) {
              if (kf.type === CSSRule.KEYFRAME_RULE) {
                const keyframe = kf as CSSKeyframeRule;
                if (keyframe.keyText === 'to' || keyframe.keyText === '100%') {
                  const transform = keyframe.style.transform || keyframe.style.getPropertyValue('transform');
                  const match = transform.match(/translateX\(\s*(\d+)%\s*\)/);
                  if (match) return parseInt(match[1], 10);
                }
              }
            }
          }
        } catch (e) {}
      }
      return null;
    });

    expect(transformPercent).not.toBeNull();
    // Enforces the 75% guidance recommendation and prevents the 25% regression
    expect(transformPercent).toBeGreaterThanOrEqual(75);
  });

  test('Non-active views are marked inert', async ({ page }) => {
    // Navigate to slide 2
    const firstLink = page.locator('a.item').first();
    await firstLink.click();
    await page.waitForTimeout(300); // Wait for transition-related scroll layouts

    const views = page.locator('.Stack-view');
    const count = await views.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // First view (background) should be inert
    await expect(views.nth(0)).toHaveAttribute('inert', '');
    // Active view should not be inert
    await expect(views.nth(1)).not.toHaveAttribute('inert');
  });
});
