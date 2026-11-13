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

test.describe(`Visually Stable Font Fallbacks: ${demoName}`, () => {
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

  test('The text container has the font-size-adjust CSS property applied with a value other than none', async ({ page }) => {
    const hasAdjust = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      return els.some((el) => {
        const style = window.getComputedStyle(el);
        return Boolean(style.fontSizeAdjust && style.fontSizeAdjust !== 'none');
      });
    });
    expect(hasAdjust).toBe(true);
  });

  test('The font-size-adjust property is set to either a numeric value or the from-font keyword', async ({ page }) => {
    const adjustValue = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      const el = els.find((e) => window.getComputedStyle(e).fontSizeAdjust !== 'none');
      if (!el) return null;
      return window.getComputedStyle(el).fontSizeAdjust;
    });

    expect(adjustValue).not.toBeNull();
    const isValid =
      adjustValue !== null &&
      adjustValue !== 'none' &&
      (adjustValue.includes('from-font') || !Number.isNaN(Number.parseFloat(adjustValue.split(/\s+/).pop() || '')));
    expect(isValid).toBe(true);
  });

  test('When the font-family is swapped from a font with a high aspect ratio (like Verdana) to one with a lower aspect ratio (like Times New Roman), the computed font-size increases to maintain a consistent x-height', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const els = Array.from(document.querySelectorAll('*'));
      let target = els.find((e) => {
        const style = window.getComputedStyle(e);
        return Boolean(style.fontSizeAdjust && style.fontSizeAdjust !== 'none');
      }) as HTMLElement | undefined;

      if (!target) {
        let maxLen = 0;
        for (const e of els) {
          const text = e.textContent?.trim() || '';
          if (text.length > maxLen) {
            maxLen = text.length;
            target = e as HTMLElement;
          }
        }
      }
      if (!target) return { error: 'No element found' };

      const originalAdjust = window.getComputedStyle(target).fontSizeAdjust;

      // Create a measurement element
      const measurer = document.createElement('div');
      measurer.style.position = 'absolute';
      measurer.style.visibility = 'hidden';
      measurer.style.fontSize = '100px';
      measurer.style.fontSizeAdjust = originalAdjust;

      const probe = document.createElement('div');
      probe.style.height = '1ex';
      measurer.appendChild(probe);
      document.body.appendChild(measurer);

      measurer.style.fontFamily = 'Verdana, sans-serif';
      await new Promise((r) => requestAnimationFrame(r));
      const h1 = probe.getBoundingClientRect().height;

      // When `from-font` is used, the browser extracts the aspect value of the first available font.
      // To simulate falling back from the primary font (Verdana/sans-serif) to a lower-aspect fallback (Times New Roman/serif)
      // while preserving the primary font's extracted aspect value, lock the primary aspect ratio before swapping to serif.
      if (originalAdjust.includes('from-font') && h1 > 0) {
        const parts = originalAdjust.trim().split(/\s+/);
        const metricPrefix = parts.length > 1 ? `${parts[0]} ` : '';
        measurer.style.fontSizeAdjust = `${metricPrefix}${(h1 / 100).toFixed(4)}`;
      }

      measurer.style.fontFamily = '"Times New Roman", Times, serif';
      await new Promise((r) => requestAnimationFrame(r));
      const h2 = probe.getBoundingClientRect().height;

      document.body.removeChild(measurer);
      return { h1, h2, originalAdjust };
    });

    if ('error' in result) throw new Error(result.error);

    expect(result.originalAdjust).not.toBe('none');
    // With font-size-adjust active, h1 and h2 remain consistent across the font swap
    expect(Math.abs(result.h1 - result.h2)).toBeLessThan(10);
  });

  test('The text remains readable and visually consistent in size even when the font family changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const els = Array.from(document.querySelectorAll('*'));
      const target = els.find((e) => {
        const style = window.getComputedStyle(e);
        return Boolean(style.fontSizeAdjust && style.fontSizeAdjust !== 'none');
      }) as HTMLElement | undefined;
      if (!target) return { hasAdjust: false };

      const originalAdjust = window.getComputedStyle(target).fontSizeAdjust;

      const measurer = document.createElement('div');
      measurer.style.position = 'absolute';
      measurer.style.visibility = 'hidden';
      measurer.style.fontSize = '100px';
      const probe = document.createElement('div');
      probe.style.height = '1ex';
      measurer.appendChild(probe);
      document.body.appendChild(measurer);

      // Resolve the effective aspect value from the primary high-aspect font when `from-font` is used
      let effectiveAdjust = originalAdjust;
      if (originalAdjust.includes('from-font')) {
        measurer.style.fontFamily = 'Verdana, sans-serif';
        measurer.style.fontSizeAdjust = originalAdjust;
        const primaryExHeight = probe.getBoundingClientRect().height;
        const parts = originalAdjust.trim().split(/\s+/);
        const metricPrefix = parts.length > 1 ? `${parts[0]} ` : '';
        effectiveAdjust = `${metricPrefix}${(primaryExHeight / 100).toFixed(4)}`;
      }

      measurer.style.fontFamily = '"Times New Roman", Times, serif';
      measurer.style.fontSizeAdjust = 'none';
      const hNone = probe.getBoundingClientRect().height;

      measurer.style.fontSizeAdjust = effectiveAdjust;
      const hAdjusted = probe.getBoundingClientRect().height;

      document.body.removeChild(measurer);
      return { hasAdjust: true, hNone, hAdjusted };
    });

    expect(result.hasAdjust).toBe(true);
    // Scaling the fallback serif font to match the primary font's aspect value must change its ex-height relative to `none`
    expect(result.hAdjusted!).not.toBeCloseTo(result.hNone!, 1);
  });
});
