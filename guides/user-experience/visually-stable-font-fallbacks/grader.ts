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

  test('The text container has font-size-adjust applied', async ({ page }) => {
    const hasAdjust = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      return els.some(el => {
        const style = window.getComputedStyle(el);
        return style.fontSizeAdjust && style.fontSizeAdjust !== 'none';
      });
    });
    expect(hasAdjust).toBe(true);
  });

  test('The font-size-adjust property is numeric or from-font', async ({ page }) => {
    const adjustValue = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      const el = els.find(e => window.getComputedStyle(e).fontSizeAdjust !== 'none');
      if (!el) return null;
      return window.getComputedStyle(el).fontSizeAdjust;
    });
    
    expect(adjustValue).not.toBeNull();
    const isValid = adjustValue === 'from-font' || (adjustValue !== null && !isNaN(parseFloat(adjustValue)));
    expect(isValid).toBe(true);
  });

  test('The x-height remains consistent when the font family changes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const els = Array.from(document.querySelectorAll('*'));
      let target = els.find(e => {
        const style = window.getComputedStyle(e);
        return style.fontSizeAdjust && style.fontSizeAdjust !== 'none';
      }) as HTMLElement;
      
      if (!target) {
          let maxLen = 0;
          for (const e of els) {
              const text = e.textContent?.trim() || '';
              if (text.length > maxLen) { maxLen = text.length; target = e as HTMLElement; }
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

      measurer.style.fontFamily = 'sans-serif';
      await new Promise(r => requestAnimationFrame(r));
      const h1 = probe.getBoundingClientRect().height;

      measurer.style.fontFamily = 'serif';
      await new Promise(r => requestAnimationFrame(r));
      const h2 = probe.getBoundingClientRect().height;

      document.body.removeChild(measurer);
      return { h1, h2, originalAdjust };
    });

    if ('error' in result) throw new Error(result.error);
    
    // In demo.html, font-size-adjust is active, so h1 should be very close to h2.
    // We expect originalAdjust to be something other than 'none'.
    expect(result.originalAdjust).not.toBe('none');
    expect(result.h1).toBeCloseTo(result.h2, 1);
  });

  test('The text remains readable and visually consistent in size', async ({ page }) => {
    // We verify this by checking if font-size-adjust actually affects the layout
    const result = await page.evaluate(async () => {
        const els = Array.from(document.querySelectorAll('*'));
        let target = els.find(e => {
          const style = window.getComputedStyle(e);
          return style.fontSizeAdjust && style.fontSizeAdjust !== 'none';
        }) as HTMLElement;
        if (!target) return { hasAdjust: false };

        const originalAdjust = window.getComputedStyle(target).fontSizeAdjust;
        
        const measurer = document.createElement('div');
        measurer.style.fontSize = '100px';
        measurer.style.fontFamily = 'serif'; // Use a font where aspect ratio is likely not the adjust value
        const probe = document.createElement('div');
        probe.style.height = '1ex';
        measurer.appendChild(probe);
        document.body.appendChild(measurer);

        measurer.style.fontSizeAdjust = 'none';
        const hNone = probe.getBoundingClientRect().height;

        measurer.style.fontSizeAdjust = originalAdjust;
        const hAdjusted = probe.getBoundingClientRect().height;

        document.body.removeChild(measurer);
        return { hasAdjust: true, hNone, hAdjusted };
    });

    expect(result.hasAdjust).toBe(true);
    if (!result.hasAdjust) return;
    // If working, hAdjusted should be different from hNone (unless originalAdjust matches the font perfectly)
    // But since we use 'serif' and the adjust is usually for 'sans-serif' or specific web fonts, it should differ.
    expect(result.hAdjusted).not.toBeCloseTo(result.hNone!, 1);
  });

});
