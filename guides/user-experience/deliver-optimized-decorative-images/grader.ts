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

test.describe(`deliver-optimized-decorative-images Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('The element has a standard background image or mask image declaration acting as a fallback.', async ({ page }) => {
    const hasFallback = await page.evaluate(async () => {
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '');
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of links) {
        try {
          const res = await fetch((link as HTMLLinkElement).href);
          styles.push(await res.text());
        } catch (e) {
           // ignore
        }
      }
      
      const noComments = styles.map(s => s.replace(/\/\*[\s\S]*?\*\//g, ''));
      const blocksToExamine = [];

      for (const style of noComments) {
        const blocks = style.split('}');
        for (const block of blocks) {
          blocksToExamine.push(block);
        }
      }

      // Also check inline styles
      const inlineEls = Array.from(document.querySelectorAll('[style]'));
      for (const el of inlineEls) {
         blocksToExamine.push(el.getAttribute('style') || '');
      }

      for (const block of blocksToExamine) {
        if (block.includes('image-set')) {
          const bgRegex = /(?:background(?:-image)?|mask(?:-image)?)\s*:[^;\}]+/gi;
          let propMatch;
          const props = [];
          while ((propMatch = bgRegex.exec(block)) !== null) {
            props.push(propMatch[0]);
          }
          if (props.length >= 2) {
             const first = props[0];
             const last = props[props.length - 1];
             if (first.includes('url(') && !first.includes('image-set') && last.includes('image-set')) {
                return true;
             }
          }
        }
      }
      return false;
    });
    expect(hasFallback).toBe(true);
  });

  test('The element uses the image-set() function for the same property, defined after the fallback.', async ({ page }) => {
    const bg = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage.includes('image-set')) {
          return style.backgroundImage;
        }
        if (style.background.includes('image-set')) {
          return style.background;
        }
        if (style.maskImage.includes('image-set')) {
          return style.maskImage;
        }
      }
      return null;
    });
    expect(bg).not.toBeNull();
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x).', async ({ page }) => {
    const bg = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage.includes('image-set')) return style.backgroundImage;
        if (style.maskImage.includes('image-set')) return style.maskImage;
      }
      return null;
    });
    const matches = (bg || '').match(/\b\d+(?:\.\d+)?(?:x|dppx|dpi|dpcm)\b/gi) || [];
    // Ensure we have at least 2 distinct usages or just multiple entries in general?
    // The demo has 1x and 2x for webp, and 1x and 2x for jpg. So 4 matches.
    // The expectation says "includes multiple pixel density descriptors".
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

});
