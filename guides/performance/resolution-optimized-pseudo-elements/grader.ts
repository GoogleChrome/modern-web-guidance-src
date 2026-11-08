import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}
const targetUrl = `file://${path.resolve(targetFile)}`;

test.describe('Resolution Optimized Pseudo Elements Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl);
  });

  test('A pseudo-element (::before or ::after) is used on a target element', async ({ page }) => {
    const hasPseudo = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3, .card h3, section h3'));
      return titles.some((el) => {
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        return (before.content && before.content !== 'none' && before.content !== 'normal') ||
               (after.content && after.content !== 'none' && after.content !== 'normal');
      });
    });
    expect(hasPseudo).toBe(true);
  });

  test('The pseudo-element has an image declaration for the content or background-image property', async ({ page }) => {
    const hasImage = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3, .card h3, section h3'));
      return titles.some((el) => {
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        const bg = before.backgroundImage || after.backgroundImage;
        const content = before.content || after.content;
        return (bg && bg !== 'none') || (content && (content.includes('url(') || content.includes('image-set(')));
      });
    });
    expect(hasImage).toBe(true);
  });

  test('The pseudo-element declares a url() fallback before image-set() for the same property', () => {
    // CSSOM keeps only the winning declaration, so the fallback has to be read from source
    const css = fs.readFileSync(path.resolve(targetFile!), 'utf8');
    const rules = css.match(/[^{}]*::?(?:before|after)[^{]*\{[^}]*\}/gi) ?? [];
    const hasOrderedFallback = rules.some((rule) =>
      ['content', 'background-image', 'background'].some((prop) => {
        const fallback = rule.search(new RegExp(`${prop}\\s*:\\s*url\\(`, 'i'));
        const imageSet = rule.search(new RegExp(`${prop}\\s*:\\s*(?:-webkit-)?image-set\\(`, 'i'));
        return fallback !== -1 && imageSet > fallback;
      })
    );
    expect(hasOrderedFallback).toBe(true);
  });

  test('The pseudo-element uses the image-set() function for resolution switching', async ({ page }) => {
    const hasImageSet = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3, .card h3, section h3'));
      const computedHasImageSet = titles.some((el) => {
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        return (before.backgroundImage && before.backgroundImage.includes('image-set(')) ||
               (after.backgroundImage && after.backgroundImage.includes('image-set('));
      });
      if (computedHasImageSet) return true;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && (rule.selectorText.includes('::before') || rule.selectorText.includes('::after') || rule.selectorText.includes(':before') || rule.selectorText.includes(':after'))) {
              if (rule.cssText.includes('image-set(')) return true;
            }
          }
        } catch {}
      }
      return false;
    });
    expect(hasImageSet).toBe(true);
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async ({ page }) => {
    const hasDensities = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && (rule.selectorText.includes('before') || rule.selectorText.includes('after'))) {
              const text = rule.cssText;
              if (text.includes('image-set(')) {
                const has1x = /\b1x\b|\b1dppx\b/.test(text);
                const has2x = /\b2x\b|\b2dppx\b/.test(text);
                if (has1x && has2x) return true;
              }
            }
          }
        } catch {}
      }
      // Also check inline style / computed style
      const titles = Array.from(document.querySelectorAll('h3, .card h3, section h3'));
      for (const el of titles) {
        const bg = window.getComputedStyle(el, '::before').backgroundImage || '';
        if (bg.includes('image-set(')) {
          const has1x = /\b1x\b|\b1dppx\b/.test(bg);
          const has2x = /\b2x\b|\b2dppx\b/.test(bg);
          if (has1x && has2x) return true;
        }
      }
      return false;
    });
    expect(hasDensities).toBe(true);
  });
});
