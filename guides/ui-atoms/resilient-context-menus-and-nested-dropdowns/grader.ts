import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFilePath = path.resolve(process.env.TARGET_FILE || './demo.html');
const targetDir = path.dirname(targetFilePath);
const targetFileName = path.basename(targetFilePath);
const targetFileUrl = `http://localhost/${targetFileName}`;

const getExternalScriptTexts = (): string[] => {
  const isDemoTarget = targetFileName === 'demo.html' || targetFileName === 'negative-demo.html';
  const html = fs.existsSync(targetFilePath) ? fs.readFileSync(targetFilePath, 'utf-8') : '';
  const files: string[] = [];
  if (isDemoTarget) {
    const srcMatches = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
    for (const match of srcMatches) {
      const src = match[1];
      if (!/^https?:\/\//i.test(src) && !src.startsWith('//')) {
        const resolved = path.resolve(targetDir, src.replace(/^\/+/, ''));
        if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          files.push(resolved);
        }
      }
    }
  } else {
    const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
    const walk = (dir: string) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludedDirs.has(entry.name)) walk(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.') &&
            !entry.name.includes('.config.') &&
            entry.name !== 'grade.mjs' &&
            entry.name !== 'run.mjs'
          ) {
            files.push(fullPath);
          }
        }
      } catch {}
    };
    walk(targetDir);
  }
  return [...new Set(files)].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf-8'));
};

test.describe('Resilient Context Menus and Nested Dropdowns Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const reqPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = reqPath === '/' ? targetFileName : reqPath.replace(/^\/+/, '');
      const resolved = path.resolve(targetDir, relPath);
      if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        await route.fulfill({ path: resolved });
      } else {
        await route.continue();
      }
    });
  });

  test('The dropdown menu uses the Popover API', async ({ page }) => {
    await page.goto(targetFileUrl);
    const panel = page.locator('#action-panel');
    await expect(panel).toHaveAttribute('popover');
  });

  test('The trigger has popovertarget matching the dropdown menu ID', async ({ page }) => {
    await page.goto(targetFileUrl);
    const trigger = page.locator('#trigger-btn');
    await expect(trigger).toHaveAttribute('popovertarget', 'action-panel');
  });

  test('The stylesheet uses anchor() on inset properties to position the target relative to the anchor', async ({ page }) => {
    await page.goto(targetFileUrl);
    const usesAnchor = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const text = rule.cssText;
            if (text.includes('anchor(') || text.includes('position-area') || text.includes('position-anchor')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(usesAnchor).toBe(true);
  });

  test('The stylesheet defines position-try-fallbacks for overflow handling', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasPositionTry = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes('position-try-fallbacks')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(hasPositionTry).toBe(true);
  });

  test('The stylesheet uses flip-block, flip-inline, or equivalent custom @position-try rules for edge collisions', async ({ page }) => {
    await page.goto(targetFileUrl);
    const hasEdgeHandling = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const text = rule.cssText;
            if (text.includes('flip-block') || text.includes('flip-inline') || text.includes('@position-try')) {
              return true;
            }
          }
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      }
      return false;
    });
    expect(hasEdgeHandling).toBe(true);
  });

  test('The popover polyfill is conditionally loaded based on popover support', async ({ page }) => {
    await page.goto(targetFileUrl);
    const inlineScripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).map(s => s.textContent || '')
    );
    const allScripts = [...inlineScripts, ...getExternalScriptTexts()];
    const hasPopoverPolyfill = allScripts.some(code => {
      const checksPopover = code.includes('popover') && (code.includes('hasOwnProperty') || code.includes('in HTMLElement') || code.includes('in document'));
      const loadsPolyfill = code.includes('popover-polyfill');
      return checksPopover && loadsPolyfill;
    });
    expect(hasPopoverPolyfill).toBe(true);
  });

  test('The anchor positioning polyfill is conditionally loaded based on support', async ({ page }) => {
    await page.goto(targetFileUrl);
    const inlineScripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).map(s => s.textContent || '')
    );
    const allScripts = [...inlineScripts, ...getExternalScriptTexts()];
    const hasAnchorPolyfill = allScripts.some(code => {
      const checksAnchor =
        code.includes('anchorName') ||
        code.includes('positionAnchor') ||
        code.includes('anchor-name') ||
        code.includes('position-area') ||
        code.includes('position-try-fallbacks');
      const loadsPolyfillOrFallback =
        code.includes('css-anchor-positioning') ||
        (code.includes('CSS.supports') && code.includes('getBoundingClientRect'));
      return checksAnchor && loadsPolyfillOrFallback;
    });
    expect(hasAnchorPolyfill).toBe(true);
  });

  test('The overlay container does not have role="menu"', async ({ page }) => {
    await page.goto(targetFileUrl);
    const panel = page.locator('#action-panel');
    await expect(panel).not.toHaveAttribute('role', 'menu');
  });

  test('The trigger does not have aria-haspopup', async ({ page }) => {
    await page.goto(targetFileUrl);
    const trigger = page.locator('#trigger-btn');
    await expect(trigger).not.toHaveAttribute('aria-haspopup');
  });

  test('The items in the overlay do not have role="menuitem"', async ({ page }) => {
    await page.goto(targetFileUrl);
    const menuitems = page.locator('#action-panel [role="menuitem"]');
    await expect(menuitems).toHaveCount(0);
  });

});
