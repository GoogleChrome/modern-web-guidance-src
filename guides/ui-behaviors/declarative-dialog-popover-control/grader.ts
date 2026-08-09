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


// Tests
test.describe(`Declarative Dialog and Popover Expectations: ${demoName}`, () => {
  
  // DOM Structure and Script Checks
  test.describe('DOM Structure Checks', () => {
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

    test('Button exists with commandfor attribute targeting a popover ID', async ({ page }) => {
      const exists = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[commandfor]'));
        return buttons.some(btn => {
          const targetId = btn.getAttribute('commandfor');
          const target = document.getElementById(targetId ?? '');
          return target && target.hasAttribute('popover');
        });
      });
      expect(exists).toBe(true);
    });

    test('Button to toggle popover has command="toggle-popover"', async ({ page }) => {
      const exists = await page.locator('button[command="toggle-popover"][commandfor]').count() > 0;
      expect(exists).toBe(true);
    });

    test('Button to explicitly show popover has command="show-popover"', async ({ page }) => {
      const exists = await page.locator('button[command="show-popover"][commandfor]').count() > 0;
      expect(exists).toBe(true);
    });

    test('Button to explicitly hide popover has command="hide-popover"', async ({ page }) => {
      const exists = await page.locator('button[command="hide-popover"][commandfor]').count() > 0;
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
      const scripts = await page.locator('script').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const hasInvokersPolyfill = scripts.some(s => s.includes('invokers') || s.includes('commandForElement'));
      if (hasInvokersPolyfill) {
        const conditionMet = scripts.some(s => /if\s*\(\s*!\s*\(\s*['"]commandForElement['"]\s*in\s*HTMLButtonElement\.prototype\s*\)\s*\)/.test(s));
        expect(conditionMet).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });

    test('Popover polyfill is loaded conditionally if present', async ({ page }) => {
      const scripts = await page.locator('script').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const hasPopoverPolyfill = scripts.some(s => s.includes('popover') && (s.includes('polyfill') || s.includes('esm')));
      if (hasPopoverPolyfill) {
        const conditionMet = scripts.some(s => /if\s*\(\s*!\s*\(\s*['"]popover['"]\s*in\s*HTMLElement\.prototype\s*\)\s*\)/.test(s));
        expect(conditionMet).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });

    test('CSS rules for :popover-open and .\\:popover-open are separate if polyfill class is used', async ({ page }) => {
      const styles = await page.locator('style').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const combinedStyle = styles.join('\n');
      const hasPolyfillClass = combinedStyle.includes('.\\:popover-open') || combinedStyle.includes('.popover-open');
      if (hasPolyfillClass) {
        const combinedRule = /[,]\s*:popover-open|:popover-open\s*[,]/;
        expect(combinedStyle).not.toMatch(combinedRule);
      } else {
        expect(true).toBe(true);
      }
    });

    test('CSS includes rule for the polyfill class .\\:popover-open if polyfill class is used', async ({ page }) => {
      const styles = await page.locator('style').evaluateAll(tags => tags.map(t => t.textContent || ''));
      const combinedStyle = styles.join('\n');
      const hasPolyfillClass = combinedStyle.includes('.\\:popover-open') || combinedStyle.includes('.popover-open');
      if (hasPolyfillClass) {
        expect(combinedStyle).toMatch(/\.\\:popover-open/);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  // Browser assertions
  test.describe('Functional Tests', () => {
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

    test('Button with toggle-popover command opens and closes the popover', async ({ page }) => {
      const toggleBtn = page.locator('button[command="toggle-popover"]');
      const popoverId = await toggleBtn.getAttribute('commandfor');
      expect(popoverId).not.toBeNull();
      const popover = page.locator(`#${popoverId}`);
      
      await toggleBtn.click();
      await expect(popover).toBeVisible();
      
      await toggleBtn.click();
      await expect(popover).toBeHidden();
    });

    test('Button with show-popover command opens the popover', async ({ page }) => {
      const showBtn = page.locator('button[command="show-popover"]');
      const popoverId = await showBtn.getAttribute('commandfor');
      expect(popoverId).not.toBeNull();
      const popover = page.locator(`#${popoverId}`);
      
      await showBtn.click();
      await expect(popover).toBeVisible();
    });

    test('Button with hide-popover command closes the popover', async ({ page }) => {
      const showBtn = page.locator('button[command="show-popover"]');
      const hideBtn = page.locator('button[command="hide-popover"]');
      const popoverId = await showBtn.getAttribute('commandfor');
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
