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

// Tests
test.describe(`Adapt scrollbar to high-contrast preferences Expectations: ${demoName}`, () => {
  // 1. CSS variables defined for scrollbar colors
  test('CSS variables are defined for scrollbar thumb and track colors', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasThumbVar = /--[a-zA-Z0-9_-]*thumb[a-zA-Z0-9_-]*\s*:/.test(html);
    const hasTrackVar = /--[a-zA-Z0-9_-]*track[a-zA-Z0-9_-]*\s*:/.test(html);
    expect(hasThumbVar && hasTrackVar).toBe(true);
  });

  // 2. @media (prefers-contrast: more) block updates the CSS variables
  test('An @media (prefers-contrast: more) block updates scrollbar CSS variables', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const mediaQueryRegex = /@media\s*\(\s*prefers-contrast\s*:\s*more\s*\)\s*\{[\s\S]*?--[a-zA-Z0-9_-]*(thumb|track)[a-zA-Z0-9_-]*\s*:[\s\S]*?\}/;
    expect(mediaQueryRegex.test(html)).toBe(true);
  });

  // 3. scrollbar-color property uses the variables
  test('The scrollbar-color property uses CSS variables', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const scrollbarColorRegex = /scrollbar-color\s*:\s*var\(--[a-zA-Z0-9_-]+\)\s+var\(--[a-zA-Z0-9_-]+\)/;
    expect(scrollbarColorRegex.test(html)).toBe(true);
  });

  // 4. Legacy fallback isolation within @supports not (scrollbar-color: auto)
  test('Legacy scrollbar pseudo-elements are isolated within @supports not (scrollbar-color: auto)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasWebkitScrollbar = /::-webkit-scrollbar/.test(html);
    const hasSupportsQuery = /@supports\s*not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)/.test(html);

    if (hasWebkitScrollbar) {
      expect(hasSupportsQuery).toBe(true);
    } else {
      expect(html).toMatch(/scrollbar-color\s*:/);
    }
  });

  // Browser testing setup
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

  // 5. Browser test: Verify variables change under prefers-contrast: more
  test('CSS variables for scrollbar update to high-contrast colors when prefers-contrast: more is emulated', async ({ page }) => {
    const getThumb = () => page.evaluate(() => {
      const candidates = [
        document.querySelector('.scroller, .adaptive-contrast, .content-box'),
        document.documentElement,
        document.body,
      ].filter((el): el is HTMLElement => el !== null);

      for (const el of candidates) {
        const style = getComputedStyle(el);
        const val = style.getPropertyValue('--scrollbar-thumb').trim() ||
                    style.getPropertyValue('--thumb').trim() ||
                    style.getPropertyValue('--scrollbar-color-thumb').trim();
        if (val) return val;
      }
      return '';
    });

    const initialThumb = await getThumb();
    await page.emulateMedia({ contrast: 'more' });
    const highContrastThumb = await getThumb();

    expect(highContrastThumb).not.toBe('');
    expect(highContrastThumb.toLowerCase()).not.toBe(initialThumb.toLowerCase());
  });

  // 6. Browser test: High contrast colors are actually distinct
  test('High contrast scrollbar colors are highly distinct', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });

    const colors = await page.evaluate(() => {
      const candidates = [
        document.querySelector('.scroller, .adaptive-contrast, .content-box'),
        document.documentElement,
        document.body,
      ].filter((el): el is HTMLElement => el !== null);

      let thumb = '';
      let track = '';
      for (const el of candidates) {
        const style = getComputedStyle(el);
        if (!thumb) {
          thumb = style.getPropertyValue('--scrollbar-thumb').trim() ||
                  style.getPropertyValue('--thumb').trim() ||
                  style.getPropertyValue('--scrollbar-color-thumb').trim();
        }
        if (!track) {
          track = style.getPropertyValue('--scrollbar-track').trim() ||
                  style.getPropertyValue('--track').trim() ||
                  style.getPropertyValue('--scrollbar-color-track').trim();
        }
      }
      return { thumb: thumb.toLowerCase(), track: track.toLowerCase() };
    });

    const isHighContrast =
      colors.thumb === '#000000' ||
      colors.thumb === '#000' ||
      colors.thumb === 'black' ||
      colors.thumb === 'rgb(0, 0, 0)' ||
      colors.track === '#ffffff' ||
      colors.track === '#fff' ||
      colors.track === 'white' ||
      colors.track === 'rgb(255, 255, 255)';

    expect(isHighContrast).toBe(true);
  });
});
