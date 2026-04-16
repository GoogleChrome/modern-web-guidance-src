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
test.describe(`persistent-top-layer-ui Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const fileName = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, fileName);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test('The document contains a top-layer element', async ({ page }) => {
    await page.goto(demoUrl);
    const count = await page.locator('dialog, [popover]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('The script contains a feature detection check for moveBefore', async ({ page }) => {
    await page.goto(demoUrl);
    const scripts = await page.locator('script').allTextContents();
    const code = scripts.join('\n');
    const hasCheck = code.includes('moveBefore') && (
      code.includes('in Element.prototype') || 
      code.includes('typeof') || 
      code.includes('undefined') ||
      /if\s*\(\s*.*?\.moveBefore\s*\)/.test(code)
    );
    expect(hasCheck).toBe(true);
  });

  test('The script uses moveBefore to move the top-layer element to a new parent if the feature is supported', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__moveBeforeCalled = false;
      if (typeof Element !== 'undefined') {
        const nativeInsertBefore = Element.prototype.insertBefore;
        (Element.prototype as any).moveBefore = function(node: any, ref: any) {
          (window as any).__moveBeforeCalled = true;
          return nativeInsertBefore.call(this, node, ref);
        };
      }
    });
    await page.goto(demoUrl);
    
    const openBtn = page.getByRole('button', { name: /open/i }).first();
    if (await openBtn.count() > 0) {
      await openBtn.click();
    }
    
    const moveBtn = page.getByRole('button', { name: /move/i }).first();
    await moveBtn.click();
    
    const called = await page.evaluate(() => (window as any).__moveBeforeCalled);
    expect(called).toBe(true);
  });

  test('The script falls back to using insertBefore or appendChild if moveBefore is not supported', async ({ browser }) => {
    // Check behavior WITH moveBefore
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const fileName = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, fileName);
      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page1.addInitScript(() => {
      (window as any).__traditionalMoveCalled = false;
      if (typeof Element !== 'undefined') {
        const nativeInsertBefore = Element.prototype.insertBefore;
        (Element.prototype as any).moveBefore = function(node: any, ref: any) {
          return nativeInsertBefore.call(this, node, ref);
        };
        const origAppend = Element.prototype.appendChild;
        (Element.prototype as any).appendChild = function(...args: any[]) {
          (window as any).__traditionalMoveCalled = true;
          return origAppend.apply(this, args as any);
        };
        (Element.prototype as any).insertBefore = function(...args: any[]) {
          (window as any).__traditionalMoveCalled = true;
          return nativeInsertBefore.apply(this, args as any);
        };
      }
    });
    await page1.goto(demoUrl);
    const openBtn1 = page1.getByRole('button', { name: /open/i }).first();
    if (await openBtn1.count() > 0) {
      await openBtn1.click();
    }
    await page1.evaluate(() => { (window as any).__traditionalMoveCalled = false; });
    await page1.getByRole('button', { name: /move/i }).first().click();
    const calledWithSupport = await page1.evaluate(() => (window as any).__traditionalMoveCalled);
    await context1.close();

    // Check behavior WITHOUT moveBefore
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const fileName = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, fileName);
      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page2.addInitScript(() => {
      (window as any).__traditionalMoveCalled = false;
      if (typeof Element !== 'undefined') {
        delete (Element.prototype as any).moveBefore;
        const origAppend = Element.prototype.appendChild;
        (Element.prototype as any).appendChild = function(...args: any[]) {
          (window as any).__traditionalMoveCalled = true;
          return origAppend.apply(this, args as any);
        };
        const origInsert = Element.prototype.insertBefore;
        (Element.prototype as any).insertBefore = function(...args: any[]) {
          (window as any).__traditionalMoveCalled = true;
          return origInsert.apply(this, args as any);
        };
      }
    });
    await page2.goto(demoUrl);
    const openBtn2 = page2.getByRole('button', { name: /open/i }).first();
    if (await openBtn2.count() > 0) {
      await openBtn2.click();
    }
    await page2.evaluate(() => { (window as any).__traditionalMoveCalled = false; });
    await page2.getByRole('button', { name: /move/i }).first().click();
    const calledWithoutSupport = await page2.evaluate(() => (window as any).__traditionalMoveCalled);
    await context2.close();

    const isFallback = !calledWithSupport && calledWithoutSupport;
    expect(isFallback).toBe(true);
  });
});
