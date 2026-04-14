import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`resolution-optimized-pseudo-elements Expectations: ${demoName}`, () => {
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

  test('A pseudo-element (::before or ::after) is used on a target element.', async ({ page }) => {
    const hasPseudo = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        if (before.content && before.content !== 'none' && before.content !== 'normal') return true;
        if (after.content && after.content !== 'none' && after.content !== 'normal') return true;
        if (before.backgroundImage && before.backgroundImage !== 'none') return true;
        if (after.backgroundImage && after.backgroundImage !== 'none') return true;
      }
      return false;
    });
    expect(hasPseudo).toBe(true);
  });

  test('The pseudo-element has a standard image declaration acting as a fallback', async ({ page }) => {
    const rawStyles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    });

    // Simplistic regex matching for demo purposes
    // Remove comments to prevent false positives
    const strippedStyles = rawStyles.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = Array.from(strippedStyles.matchAll(/::(?:before|after)\s*\{([^}]+)\}/g)).map(m => m[1]);

    let hasFallback = false;
    for (const block of blocks) {
      const contents = Array.from(block.matchAll(/content\s*:\s*([^;]+)(?:;|$)/g)).map(m => m[1]);
      const bgs = Array.from(block.matchAll(/background-image\s*:\s*([^;]+)(?:;|$)/g)).map(m => m[1]);

      const checkFallback = (matches: string[]) => {
        return matches.some(val => val.includes('url(') && !val.includes('image-set('));
      };
      if (checkFallback(contents) || checkFallback(bgs)) {
        hasFallback = true;
        break;
      }
    }
    expect(hasFallback).toBe(true);
  });

  test('The pseudo-element uses the image-set() function for the same property, defined after the fallback.', async ({ page }) => {
    const rawStyles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    });

    const strippedStyles = rawStyles.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = Array.from(strippedStyles.matchAll(/::(?:before|after)\s*\{([^}]+)\}/g)).map(m => m[1]);

    let isAfterFallback = false;
    for (const block of blocks) {
      const contents = Array.from(block.matchAll(/content\s*:\s*([^;]+)(?:;|$)/g)).map(m => m[1]);
      const bgs = Array.from(block.matchAll(/background-image\s*:\s*([^;]+)(?:;|$)/g)).map(m => m[1]);

      const checkOrder = (matches: string[]) => {
        let fallbackIndex = -1;
        let imageSetIndex = -1;
        for (let i = 0; i < matches.length; i++) {
          const val = matches[i];
          if (val.includes('url(') && !val.includes('image-set(')) {
            fallbackIndex = i;
          }
          if (val.includes('image-set(')) {
            imageSetIndex = i;
          }
        }
        return fallbackIndex !== -1 && imageSetIndex !== -1 && fallbackIndex < imageSetIndex;
      };

      if (checkOrder(contents) || checkOrder(bgs)) {
        isAfterFallback = true;
        break;
      }
    }
    expect(isAfterFallback).toBe(true);
  });

  test('The image-set() function includes multiple pixel density descriptors', async ({ page }) => {
    const hasMultipleDensities = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        const check = (val: string) => {
          if (!val.includes('image-set(')) return false;
          // In computed styles, 1x might be converted to 1dppx, 2x to 2dppx
          const dppxMatches = val.match(/\d+dppx/g) || [];
          const xMatches = val.match(/\d+x/g) || [];
          const matches = new Set([...dppxMatches, ...xMatches]);
          return matches.size > 1;
        };
        if (check(before.content) || check(before.backgroundImage) || check(after.content) || check(after.backgroundImage)) return true;
      }
      return false;
    });
    expect(hasMultipleDensities).toBe(true);
  });
});