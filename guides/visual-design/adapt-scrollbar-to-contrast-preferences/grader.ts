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
    const getScrollbarState = () => page.evaluate(() => {
      const candidates = [
        ...Array.from(document.querySelectorAll<HTMLElement>('.scroller, .adaptive-contrast, .content-box, [style*="scrollbar-color"]')),
        document.documentElement,
        document.body,
        ...Array.from(document.querySelectorAll<HTMLElement>('*')),
      ].filter((el): el is HTMLElement => el !== null);

      for (const el of candidates) {
        const style = getComputedStyle(el);
        if (style.scrollbarColor && style.scrollbarColor !== 'auto') {
          return style.scrollbarColor.trim();
        }
        const val = style.getPropertyValue('--scrollbar-thumb').trim() ||
                    style.getPropertyValue('--thumb').trim() ||
                    style.getPropertyValue('--scrollbar-color-thumb').trim();
        if (val) return val;
      }
      return '';
    });

    const initialState = await getScrollbarState();
    await page.emulateMedia({ contrast: 'more' });
    const highContrastState = await getScrollbarState();

    expect(highContrastState).not.toBe('');
    expect(highContrastState.toLowerCase()).not.toBe(initialState.toLowerCase());
  });

  // 6. Browser test: High contrast colors are actually distinct
  test('High contrast scrollbar colors are highly distinct', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });

    const contrastRatio = await page.evaluate(() => {
      const candidates = [
        ...Array.from(document.querySelectorAll<HTMLElement>('.scroller, .adaptive-contrast, .content-box, [style*="scrollbar-color"]')),
        document.documentElement,
        document.body,
        ...Array.from(document.querySelectorAll<HTMLElement>('*')),
      ].filter((el): el is HTMLElement => el !== null);

      const resolveToRgb = (colorStr: string): [number, number, number] | null => {
        if (!colorStr) return null;
        const probe = document.createElement('div');
        probe.style.color = colorStr;
        document.body.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        const m = resolved.match(/\d+(\.\d+)?/g);
        return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
      };

      const relLuminance = ([r, g, b]: [number, number, number]) => {
        const chan = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
      };

      for (const el of candidates) {
        const style = getComputedStyle(el);
        const sc = style.scrollbarColor?.trim() || '';
        if (sc && sc !== 'auto') {
          const rgbMatches = sc.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b[a-zA-Z]+\b/g);
          if (rgbMatches && rgbMatches.length >= 2) {
            const c1 = resolveToRgb(rgbMatches[0]);
            const c2 = resolveToRgb(rgbMatches[1]);
            if (c1 && c2) {
              const l1 = relLuminance(c1);
              const l2 = relLuminance(c2);
              return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            }
          }
        }
      }
      return 1;
    });

    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  });
});
