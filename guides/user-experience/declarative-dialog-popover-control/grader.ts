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

// Helper to check if a button has both attributes
function hasButtonWithAttrs(html: string, attr1: string, val1: string, attr2?: string, val2?: string) {
  const buttonRegex = /<button\s+([^>]+)>/gi;
  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const attrs = match[1];
    const hasAttr1 = new RegExp(`\\b${attr1}=["']${val1}["']`, 'i').test(attrs);
    if (hasAttr1) {
      if (!attr2) return true;
      const hasAttr2 = val2 
        ? new RegExp(`\\b${attr2}=["']${val2}["']`, 'i').test(attrs)
        : new RegExp(`\\b${attr2}`, 'i').test(attrs);
      if (hasAttr2) return true;
    }
  }
  return false;
}

// Tests
test.describe(`Declarative Dialog and Popover Expectations: ${demoName}`, () => {
  
  // Static assertions (HTML Structure)
  test('Button exists with commandfor attribute targeting a popover ID', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const buttonWithCommandFor = /<button[^>]*\bcommandfor=["']([^"']+)["'][^>]*>/i;
    const match = html.match(buttonWithCommandFor);
    expect(match).not.toBeNull();
    const targetId = match![1];
    const popoverTargetMatch = new RegExp(`<[^>]*id=["']${targetId}["'][^>]*\\bpopover\\b`, 'i');
    expect(html).toMatch(popoverTargetMatch);
  });

  test('Button to toggle popover has command="toggle-popover"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(hasButtonWithAttrs(html, 'command', 'toggle-popover', 'commandfor')).toBe(true);
  });

  test('Button to explicitly show popover has command="show-popover"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(hasButtonWithAttrs(html, 'command', 'show-popover', 'commandfor')).toBe(true);
  });

  test('Button to explicitly hide popover has command="hide-popover"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(hasButtonWithAttrs(html, 'command', 'hide-popover', 'commandfor')).toBe(true);
  });

  test('Popover target element has the popover attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const commandForIds = [...html.matchAll(/\bcommandfor=["']([^"']+)["']/gi)].map(m => m[1]);
    let foundPopover = false;
    for (const id of commandForIds) {
      if (new RegExp(`<[^>]*id=["']${id}["'][^>]*\\bpopover\\b`, 'i').test(html)) {
        foundPopover = true;
        break;
      }
    }
    expect(foundPopover).toBe(true);
  });

  test('Button exists with commandfor attribute targeting a <dialog> element', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const commandForIds = [...html.matchAll(/\bcommandfor=["']([^"']+)["']/gi)].map(m => m[1]);
    let foundDialog = false;
    for (const id of commandForIds) {
      if (new RegExp(`<dialog[^>]*id=["']${id}["']`, 'i').test(html)) {
        foundDialog = true;
        break;
      }
    }
    expect(foundDialog).toBe(true);
  });

  test('Button targeting a dialog has command="show-modal"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(hasButtonWithAttrs(html, 'command', 'show-modal', 'commandfor')).toBe(true);
  });

  test('Target element for modal control is a <dialog> element', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const match = html.match(/<button[^>]*\bcommand=["']show-modal["'][^>]*\bcommandfor=["']([^"']+)["']/i) || 
                  html.match(/<button[^>]*\bcommandfor=["']([^"']+)["'][^>]*\bcommand=["']show-modal["']/i);
    expect(match).not.toBeNull();
    const targetId = match![1];
    expect(html).toMatch(new RegExp(`<dialog[^>]*id=["']${targetId}["']`, 'i'));
  });

  test('Close button for dialog exists with command="close"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(hasButtonWithAttrs(html, 'command', 'close', 'commandfor')).toBe(true);
  });

  test('Invokers polyfill is loaded conditionally', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/if\s*\(\s*!\s*\(\s*['"]commandForElement['"]\s*in\s*HTMLButtonElement\.prototype\s*\)\s*\)/);
  });

  test('Popover polyfill is loaded conditionally', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/if\s*\(\s*!\s*\(\s*['"]popover['"]\s*in\s*HTMLElement\.prototype\s*\)\s*\)/);
  });

  test('CSS rules for :popover-open and .\\:popover-open are separate', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for comma-separated rules involving :popover-open
    const combinedRule = /[,]\s*:popover-open|:popover-open\s*[,]/;
    expect(html).not.toMatch(combinedRule);
  });

  test('CSS includes rule for the polyfill class .\\:popover-open', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/\.\\:popover-open/);
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
