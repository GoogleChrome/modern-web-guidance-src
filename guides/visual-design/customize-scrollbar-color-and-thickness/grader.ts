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

test.describe(`Scrollbar Customization Expectations: ${demoName}`, () => {
  // Static assertions
  test('Standard scrollbar-width property is used in CSS', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/scrollbar-width\s*:/);
  });

  test('Standard scrollbar-color property is used in CSS', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/scrollbar-color\s*:/);
  });

  test('Legacy ::-webkit-scrollbar is wrapped in @supports not (scrollbar-color: auto)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check if @supports not (scrollbar-color: auto) exists and contains ::-webkit-scrollbar
    const supportsMatch = html.match(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar/s);
    expect(supportsMatch).not.toBeNull();
  });

  test('Legacy ::-webkit-scrollbar has width or height defined for visibility', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // We check for width or height inside the @supports block to ensure it's part of the correctly implemented fallback
    const legacySizingMatch = html.match(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar\s*{[^}]*(width|height)\s*:/s);
    expect(legacySizingMatch).not.toBeNull();
  });

  // Setup browser testing
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

  // Browser assertions
  test('Scrollable element has scrollbar-width applied', async ({ page }) => {
    const hasScrollbarWidth = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        const hasRule = document.querySelector('style')?.textContent?.includes('scrollbar-width') || Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => rule.cssText.includes('scrollbar-width'));
          } catch (e) { return false; }
        });
        return isScrollable && (style.scrollbarWidth !== 'auto' || hasRule);
      });
    });
    expect(hasScrollbarWidth).toBe(true);
  });

  test('Scrollable element has scrollbar-color applied', async ({ page }) => {
    const hasScrollbarColor = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        const hasRule = document.querySelector('style')?.textContent?.includes('scrollbar-color') || Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => rule.cssText.includes('scrollbar-color'));
          } catch (e) { return false; }
        });
        return isScrollable && (style.scrollbarColor !== 'auto' || hasRule);
      });
    });
    expect(hasScrollbarColor).toBe(true);
  });

  test('The thumb color of each `scrollbar-color` value has a contrast ratio of at least 3:1 against its track color.', async ({ page }) => {
    const contrastCheck = await page.evaluate(() => {
      type Rgba = [number, number, number, number];
      type Rgb = [number, number, number];

      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const failing: Array<{ thumb: string; track: string; ratio: number }> = [];
      if (!ctx) return { count: 0, failing };

      const splitColorTokens = (value: string): string[] => {
        const tokens: string[] = [];
        let depth = 0;
        let current = '';
        for (const ch of value.trim()) {
          if (ch === '(') depth++;
          else if (ch === ')') depth = Math.max(0, depth - 1);
          if (depth === 0 && /\s/.test(ch)) {
            if (current) {
              tokens.push(current);
              current = '';
            }
          } else {
            current += ch;
          }
        }
        if (current) tokens.push(current);
        return tokens;
      };

      const toRgba = (color: string): Rgba | null => {
        if (!CSS.supports('color', color)) return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return [data[0], data[1], data[2], data[3] / 255];
      };

      const over = (fg: Rgba, bg: Rgb): Rgb => {
        const a = fg[3];
        return [
          fg[0] * a + bg[0] * (1 - a),
          fg[1] * a + bg[1] * (1 - a),
          fg[2] * a + bg[2] * (1 - a),
        ];
      };

      const relLum = ([r, g, b]: Rgb): number => {
        const [lr, lg, lb] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      };

      const getEffectiveBg = (startEl: Element | null): Rgb => {
        const layers: Rgba[] = [];
        let cur: Element | null = startEl;
        while (cur) {
          const bg = toRgba(getComputedStyle(cur).backgroundColor);
          if (bg && bg[3] > 0) {
            layers.unshift(bg);
            if (bg[3] >= 1) break;
          }
          cur = cur.parentElement;
        }
        let acc: Rgb = [255, 255, 255];
        for (const layer of layers) acc = over(layer, acc);
        return acc;
      };

      const seen = new Set<string>();
      let count = 0;

      const recordPair = (computedScrollbarColor: string, backdrop: Rgb): void => {
        if (!computedScrollbarColor || computedScrollbarColor === 'auto') return;
        const tokens = splitColorTokens(computedScrollbarColor);
        if (tokens.length !== 2) return;
        const key = `${tokens[0]}|${tokens[1]}|${backdrop.join(',')}`;
        if (seen.has(key)) return;
        seen.add(key);

        const thumb = toRgba(tokens[0]);
        const track = toRgba(tokens[1]);
        if (!thumb || !track) return;

        count++;
        const effectiveTrack = over(track, backdrop);
        const effectiveThumb = over(thumb, effectiveTrack);
        const l1 = relLum(effectiveThumb);
        const l2 = relLum(effectiveTrack);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 3) {
          failing.push({ thumb: tokens[0], track: tokens[1], ratio: Number(ratio.toFixed(2)) });
        }
      };

      for (const el of Array.from(document.querySelectorAll('*'))) {
        const sc = getComputedStyle(el).scrollbarColor;
        if (sc && sc !== 'auto') {
          recordPair(sc, getEffectiveBg(el));
        }
      }

      return { count, failing };
    });

    expect(contrastCheck.count).toBeGreaterThan(0);
    expect(contrastCheck.failing).toEqual([]);
  });
});
