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

test.describe(`Precise Text Alignment Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      // Handle both root and explicit filename
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('At least one UI element (heading, button, or short label) should have text-box-trim applied', async ({ page }) => {
    const hasTrimmedUIElement = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, button, span, p, label, .button-text, .card-text'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        const trim = style.getPropertyValue('text-box-trim') || (style as any).textBoxTrim;
        if (!trim || trim === 'none' || trim === 'normal') return false;

        const text = el.textContent?.trim() || '';
        // UI elements should have short text (headings, buttons, labels)
        return text.length > 0 && text.length < 100;
      });
    });

    expect(hasTrimmedUIElement, 'Should have at least one appropriate UI element with text-box-trim').toBe(true);
  });

  test('Trimmed elements should specify font metrics (cap, alphabetic, etc) for text-box-edge', async ({ page }) => {
    const trimmedElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          const trim = style.getPropertyValue('text-box-trim') || (style as any).textBoxTrim;
          return trim && trim !== 'none' && trim !== 'normal';
        })
        .map(el => {
          const style = window.getComputedStyle(el);
          return {
            edge: style.getPropertyValue('text-box-edge') || (style as any).textBoxEdge,
            text: el.textContent?.trim() || ''
          };
        });
    });

    // Filter for appropriate UI elements (not long-form text)
    const appropriateTrimmed = trimmedElements.filter(el => el.text.length < 100);
    
    expect(appropriateTrimmed.length, 'Should have at least one appropriate UI element trimmed').toBeGreaterThan(0);

    for (const el of appropriateTrimmed) {
      expect(el.edge, 'text-box-edge should specify font metrics').toMatch(/(cap|alphabetic|ex|text|ideographic)/);
      if (el.edge && el.edge !== 'text') {
        // Should specify both edges (e.g., "cap alphabetic")
        expect(el.edge.split(' ').length, 'Both edges should be specified in text-box-edge').toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('Long-form body text should not have text-box-trim applied', async ({ page }) => {
    const trimmedLongFormCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.filter(el => {
        const style = window.getComputedStyle(el);
        const trim = style.getPropertyValue('text-box-trim') || (style as any).textBoxTrim;
        const isTrimmed = trim && trim !== 'none' && trim !== 'normal';
        const text = el.textContent?.trim() || '';
        return isTrimmed && text.length > 100;
      }).length;
    });

    expect(trimmedLongFormCount, 'Long-form text should not have text-box-trim (better for readability)').toBe(0);
  });

  test('Visual centering or flush alignment should not use magic number margins on candidate elements', async ({ page }) => {
    const magicMargins = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, button, span, p, .button-text, .card-text'));
      return candidates
        .filter(el => {
          const style = window.getComputedStyle(el);
          const mt = parseInt(style.marginTop);
          const mb = parseInt(style.marginBottom);
          // Look for significant negative margins used to "fix" alignment
          return mt < -1 || mb < -1;
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          marginTop: window.getComputedStyle(el).marginTop,
          marginBottom: window.getComputedStyle(el).marginBottom
        }));
    });

    expect(magicMargins, `Found magic margins: ${JSON.stringify(magicMargins)}`).toEqual([]);
  });

  test('text-box-trim value should be appropriate for the use case', async ({ page }) => {
    const trimmedData = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          const trim = style.getPropertyValue('text-box-trim') || (style as any).textBoxTrim;
          const text = el.textContent?.trim() || '';
          return trim && trim !== 'none' && trim !== 'normal' && text.length < 100;
        })
        .map(el => {
          const style = window.getComputedStyle(el);
          return {
            trim: style.getPropertyValue('text-box-trim') || (style as any).textBoxTrim
          };
        });
    });

    expect(trimmedData.length, 'Should have appropriate trimmed UI elements').toBeGreaterThan(0);

    for (const el of trimmedData) {
      expect(el.trim, 'text-box-trim value should be trim-both, trim-start, or trim-end').toMatch(/trim-(both|start|end)/);
    }
  });
});
