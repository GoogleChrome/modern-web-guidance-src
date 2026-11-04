/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;


function getExternalFiles(extensions: string[], attrPattern: RegExp): string[] {
  const isDemoTarget = demoName === 'demo.html' || demoName === 'negative-demo.html';
  const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const files: string[] = [];
  if (isDemoTarget) {
    const matches = html.matchAll(attrPattern);
    for (const match of matches) {
      const ref = match[1];
      if (!/^https?:\/\//i.test(ref) && !ref.startsWith('//')) {
        const resolved = path.resolve(targetDir, ref.replace(/^\/+/, ''));
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
            extensions.some(ext => entry.name.endsWith(ext)) &&
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
}

// Tests
test.describe(`Declarative Dialog and Popover Expectations: ${demoName}`, () => {
  
  // DOM Structure and Script Checks
  test.describe('DOM Structure Checks', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/**', async (route) => {
        const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
        const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
        const localFilePath = path.resolve(targetDir, relPath);

        if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });

      await page.goto(demoUrl);
    });

    test('Button exists with commandfor attribute targeting a popover ID', async ({ page }) => {
      const exists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[commandfor], button[popovertarget]'));
        return buttons.some(btn => {
          const targetId = btn.getAttribute('commandfor') || btn.getAttribute('popovertarget');
          const target = document.getElementById(targetId ?? '');
          return target && target.hasAttribute('popover');
        });
      });
      expect(exists).toBe(true);
    });

    test('Button to toggle popover has command="toggle-popover"', async ({ page }) => {
      const exists =
        (await page.locator('button[command="toggle-popover"][commandfor], button[popovertarget][popovertargetaction="toggle"], button[popovertarget]:not([popovertargetaction])').count()) > 0;
      expect(exists).toBe(true);
    });

    test('Button to explicitly show popover has command="show-popover"', async ({ page }) => {
      const exists =
        (await page.locator('button[command="show-popover"][commandfor], button[popovertarget][popovertargetaction="show"]').count()) > 0;
      expect(exists).toBe(true);
    });

    test('Button to explicitly hide popover has command="hide-popover"', async ({ page }) => {
      const exists =
        (await page.locator('button[command="hide-popover"][commandfor], button[popovertarget][popovertargetaction="hide"]').count()) > 0;
      expect(exists).toBe(true);
    });

    test('Popover target element has the popover attribute', async ({ page }) => {
      const exists = await page.locator('[popover]').count() > 0;
      expect(exists).toBe(true);
    });

    test('Button exists with commandfor attribute targeting a <dialog> element', async ({ page }) => {
      const exists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[commandfor]'));
        return buttons.some(btn => {
          const targetId = btn.getAttribute('commandfor');
          const target = document.getElementById(targetId ?? '');
          return target && target.tagName.toLowerCase() === 'dialog';
        });
      });
      expect(exists).toBe(true);
    });

    test('Button targeting a dialog has command="show-modal"', async ({ page }) => {
      const exists = await page.locator('button[command="show-modal"][commandfor]').count() > 0;
      expect(exists).toBe(true);
    });

    test('Target element for modal control is a <dialog> element', async ({ page }) => {
      const exists = await page.evaluate(() => {
        const btn = document.querySelector('button[command="show-modal"]');
        if (!btn) return false;
        const targetId = btn.getAttribute('commandfor');
        const target = document.getElementById(targetId ?? '');
        return target && target.tagName.toLowerCase() === 'dialog';
      });
      expect(exists).toBe(true);
    });

    test('Close button for dialog exists with command="close"', async ({ page }) => {
      const exists = await page.locator('button[command="close"][commandfor]').count() > 0;
      expect(exists).toBe(true);
    });

    test('Invokers polyfill is loaded conditionally if present', async ({ page }) => {
      const scriptInfo = await page.locator('script').evaluateAll(tags =>
        tags.map(t => ({ src: t.getAttribute('src') || '', text: t.textContent || '' }))
      );
      const hasStaticSrc = scriptInfo.some(s => s.src.includes('invokers'));
      expect(hasStaticSrc).toBe(false);

      const externalScripts = getExternalFiles(['.js', '.mjs'], /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
      const scripts = [...scriptInfo.map(s => s.text), ...externalScripts];
      const hasInvokersPolyfill = scripts.some(s => s.includes('invokers') || s.includes('commandForElement'));
      if (hasInvokersPolyfill) {
        const conditionMet = scripts.some(
          s =>
            /['"]commandForElement['"]\s*in\s*HTMLButtonElement\.prototype/.test(s) &&
            (/\bif\s*\(/.test(s) || /\?/.test(s))
        );
        expect(conditionMet).toBe(true);
      } else {
        const hasDeclarativeInvoker = (await page.locator('button[commandfor]').count()) > 0;
        expect(hasDeclarativeInvoker).toBe(true);
      }
    });

    test('Popover polyfill is loaded conditionally if present', async ({ page }) => {
      const scriptInfo = await page.locator('script').evaluateAll(tags =>
        tags.map(t => ({ src: t.getAttribute('src') || '', text: t.textContent || '' }))
      );
      const hasStaticSrc = scriptInfo.some(s => s.src.includes('popover-polyfill'));
      expect(hasStaticSrc).toBe(false);

      const externalScripts = getExternalFiles(['.js', '.mjs'], /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
      const scripts = [...scriptInfo.map(s => s.text), ...externalScripts];
      const hasPopoverPolyfill = scripts.some(s => s.includes('popover') && (s.includes('polyfill') || s.includes('esm') || s.includes('unpkg')));
      if (hasPopoverPolyfill) {
        const conditionMet = scripts.some(
          s =>
            /['"]popover['"]\s*in\s*HTMLElement\.prototype/.test(s) &&
            (/\bif\s*\(/.test(s) || /\?/.test(s))
        );
        expect(conditionMet).toBe(true);
      } else {
        const hasPopover = (await page.locator('[popover]').count()) > 0;
        expect(hasPopover).toBe(true);
      }
    });

    test('CSS rules for :popover-open and .\\:popover-open are separate if polyfill class is used', async ({ page }) => {
      const styles = await page.locator('style').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const externalStyles = getExternalFiles(['.css'], /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi);
      const combinedStyle = [...styles, ...externalStyles].join('\n');
      const hasPolyfillClass = combinedStyle.includes('.\\:popover-open') || combinedStyle.includes('.popover-open');
      if (hasPolyfillClass) {
        // Ignore :is(...) or :where(...) which have forgiving selector parsing
        const strippedForgiving = combinedStyle.replace(/:(?:is|where)\([^)]*\)/g, '');
        const combinedRule = /[,]\s*:popover-open|:popover-open\s*[,]/;
        expect(strippedForgiving).not.toMatch(combinedRule);
      } else {
        const hasUnforgivingCombined = /\.visible\s*,\s*:popover-open/.test(combinedStyle);
        expect(hasUnforgivingCombined).toBe(false);
      }
    });

    test('CSS includes rule for the polyfill class .\\:popover-open if polyfill class is used', async ({ page }) => {
      const styles = await page.locator('style').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const externalStyles = getExternalFiles(['.css'], /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi);
      const combinedStyle = [...styles, ...externalStyles].join('\n');
      const hasPolyfillClass = combinedStyle.includes('.\\:popover-open') || combinedStyle.includes('.popover-open');
      if (hasPolyfillClass) {
        expect(combinedStyle).toMatch(/\.\\:popover-open/);
      } else {
        const hasPopover = (await page.locator('[popover]').count()) > 0;
        expect(hasPopover).toBe(true);
      }
    });
  });

  // Browser assertions
  test.describe('Functional Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/**', async (route) => {
        const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
        const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
        const localFilePath = path.resolve(targetDir, relPath);

        if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });

      await page.goto(demoUrl);
    });

    test('Button with toggle-popover command opens and closes the popover', async ({ page }) => {
      const toggleBtn = page.locator('button[command="toggle-popover"], button[popovertarget][popovertargetaction="toggle"], button[popovertarget]:not([popovertargetaction])').first();
      const popoverId = (await toggleBtn.getAttribute('commandfor')) || (await toggleBtn.getAttribute('popovertarget'));
      expect(popoverId).not.toBeNull();
      const popover = page.locator(`#${popoverId}`);
      
      await toggleBtn.click();
      await expect(popover).toBeVisible();
      
      await toggleBtn.click();
      await expect(popover).toBeHidden();
    });

    test('Button with show-popover command opens the popover', async ({ page }) => {
      const showBtn = page.locator('button[command="show-popover"], button[popovertarget][popovertargetaction="show"]').first();
      const popoverId = (await showBtn.getAttribute('commandfor')) || (await showBtn.getAttribute('popovertarget'));
      expect(popoverId).not.toBeNull();
      const popover = page.locator(`#${popoverId}`);
      
      await showBtn.click();
      await expect(popover).toBeVisible();
    });

    test('Button with hide-popover command closes the popover', async ({ page }) => {
      const showBtn = page.locator('button[command="show-popover"], button[popovertarget][popovertargetaction="show"]').first();
      const hideBtn = page.locator('button[command="hide-popover"], button[popovertarget][popovertargetaction="hide"]').first();
      const popoverId = (await showBtn.getAttribute('commandfor')) || (await showBtn.getAttribute('popovertarget'));
      expect(popoverId).not.toBeNull();
      const popover = page.locator(`#${popoverId}`);
      
      await showBtn.click();
      await expect(popover).toBeVisible();
      
      await hideBtn.click();
      await expect(popover).toBeHidden();
    });

    test('Button with show-modal command opens the dialog as a modal', async ({ page }) => {
      const openBtn = page.locator('button[command="show-modal"]');
      const dialogId = await openBtn.getAttribute('commandfor');
      expect(dialogId).not.toBeNull();
      const dialog = page.locator(`#${dialogId}`);
      
      await openBtn.click();
      await expect(dialog).toBeVisible();
      
      const isModal = await dialog.evaluate((node) => node instanceof HTMLDialogElement && node.open);
      expect(isModal).toBe(true);
    });

    test('Button with close command closes the dialog', async ({ page }) => {
      const openBtn = page.locator('button[command="show-modal"]');
      const closeBtn = page.locator('button[command="close"]');
      const dialogId = await openBtn.getAttribute('commandfor');
      expect(dialogId).not.toBeNull();
      const dialog = page.locator(`#${dialogId}`);
      
      await openBtn.click();
      await expect(dialog).toBeVisible();
      
      await closeBtn.click();
      await expect(dialog).toBeHidden();
    });
  });
});
