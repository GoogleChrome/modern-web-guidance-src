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

test.describe(`Interest-Triggered Tooltips Expectations: ${demoName}`, () => {
  const html = fs.readFileSync(filePath, 'utf-8');

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

  test('Triggers should be <button> or <a> elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      if (triggers.length === 0) {
        // Fallback for negative cases or legacy implementations
        const legacy = Array.from(document.querySelectorAll('.tooltip[data-tooltip]'));
        return legacy.length > 0 && legacy.every(el => el.tagName === 'BUTTON' || el.tagName === 'A');
      }
      return triggers.every(el => el.tagName === 'BUTTON' || el.tagName === 'A');
    });
    expect(result).toBe(true);
  });

  test('Triggers must have an interestfor attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      // We expect at least one trigger with interestfor attribute
      return triggers.length > 0;
    });
    expect(result).toBe(true);
  });

  test('Tooltips must have popover="hint" attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('[interestfor]'));
      if (triggers.length === 0) return false;
      return triggers.every(el => {
        const id = el.getAttribute('interestfor');
        const target = id ? document.getElementById(id) : null;
        return target?.getAttribute('popover') === 'hint';
      });
    });
    expect(result).toBe(true);
  });

  test('Tooltips must have a unique id attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const popovers = Array.from(document.querySelectorAll('[popover]'));
      if (popovers.length === 0) return false;
      const ids = popovers.map(el => el.id).filter(id => id !== '');
      return ids.length === popovers.length && new Set(ids).size === ids.length;
    });
    expect(result).toBe(true);
  });

  test('Tooltip elements must be <div>', async ({ page }) => {
    const result = await page.evaluate(() => {
      const popovers = Array.from(document.querySelectorAll('[popover]'));
      return popovers.length > 0 && popovers.every(el => el.tagName === 'DIV');
    });
    expect(result).toBe(true);
  });

  test('CSS must define explicit position-anchor for tooltips', async () => {
    expect(html).toContain('position-anchor');
  });

  test('CSS must use anchor() functions for positioning', async () => {
    expect(html).toContain('anchor(');
  });

  test('CSS must define a position-try fallback', async () => {
    expect(html).toContain('position-try');
  });

  test('CSS must use anchor() positioning but NOT position-area', async () => {
    expect(html.includes('anchor(') && !/position-area\s*:/.test(html)).toBe(true);
  });

  test('Interestfor polyfill must be conditionally installed', async () => {
    const hasPolyfill = html.includes('interestfor') && html.includes('interestForElement');
    expect(hasPolyfill).toBe(true);
  });

  test('Popover polyfill must be conditionally installed', async () => {
    const hasPolyfill = html.includes('popover-polyfill') && html.includes('hasOwnProperty("popover")');
    expect(hasPolyfill).toBe(true);
  });

  test('Anchor positioning polyfill must be conditionally installed', async () => {
    const hasPolyfill = html.includes('css-anchor-positioning') && (html.includes('anchorName') || html.includes('anchor-name'));
    expect(hasPolyfill).toBe(true);
  });

  test('Tooltip content must NOT be in attributes on the trigger', async ({ page }) => {
    const result = await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll('button, a, .tooltip, [interestfor]'));
      return triggers.length > 0 && !triggers.some(el => el.hasAttribute('data-tooltip'));
    });
    expect(result).toBe(true);
  });

  test('Tooltip content must NOT be displayed using pseudo-elements', async () => {
    const hasPseudoTooltip = /::after\s*{[^}]*content:[^}]*attr\(data-tooltip\)/.test(html) || /::before\s*{[^}]*content:[^}]*attr\(data-tooltip\)/.test(html);
    expect(hasPseudoTooltip).toBe(false);
  });

  test('Tooltip should become visible on hover', async ({ page }) => {
    const trigger = page.locator('[interestfor], .tooltip').first();
    await expect(trigger).toBeVisible();
    
    const interestFor = await trigger.getAttribute('interestfor');
    if (!interestFor) {
      throw new Error('No interestfor attribute found on trigger');
    }
    
    const tooltip = page.locator(`#${interestFor}`);
    await expect(tooltip).toBeHidden();
    
    await trigger.hover();
    await page.waitForTimeout(100);
    await expect(tooltip).toBeVisible();
  });
});
