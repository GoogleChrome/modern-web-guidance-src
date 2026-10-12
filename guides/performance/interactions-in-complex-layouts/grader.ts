import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

let sharedPage: Page;
let targetDir = '';
let demoName = '';

test.beforeAll(async ({ browser }) => {
  test.setTimeout(30000);
  
  sharedPage = await browser.newPage();
  const targetFile = process.env.TARGET_FILE;
  if (!targetFile) {
    throw new Error('TARGET_FILE environment variable is not defined.');
  }
  const filePath = path.resolve(targetFile);
  targetDir = path.dirname(filePath);
  demoName = path.basename(filePath);

  await sharedPage.route('http://localhost/**', async (route) => {
    const requestPath = new URL(route.request().url()).pathname;
    const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.replace(/^\//, ''));
    if (fs.existsSync(localFilePath)) {
      await route.fulfill({ path: localFilePath });
    } else {
      await route.continue();
    }
  });

  await sharedPage.goto(`http://localhost/${demoName}`);
});

test.afterAll(async () => {
  test.setTimeout(30000);
  if (sharedPage) {
    await sharedPage.close();
  }
});

test('Target column elements must have content-visibility: auto in computed styles', async () => {
  test.setTimeout(30000);
  const contentVisibility = await sharedPage.evaluate(() => {
    const el = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!el) throw new Error('Could not find column elements');
    return window.getComputedStyle(el).contentVisibility;
  });
  
  expect(contentVisibility).toBe('auto');
});

test('Target column elements must have a non-zero contain-intrinsic-size specified', async () => {
  test.setTimeout(30000);
  const hasNonZeroSize = await sharedPage.evaluate(() => {
    const el = document.querySelector('.list') || document.querySelector('.board-column') || document.querySelector('[class*="column"]');
    if (!el) return false;
    const styles = window.getComputedStyle(el);
    const size = styles.getPropertyValue('contain-intrinsic-size') || styles.containIntrinsicSize || '';
    if (!size || size === 'none' || size === 'normal') return false;
    const numbers = size.match(/\d+/g);
    if (!numbers) return false;
    const allZeros = numbers.every(n => parseInt(n, 10) === 0);
    return !allZeros;
  });
  
  expect(hasNonZeroSize).toBe(true);
});

test('Target column elements should have contain fallback style applied for partial layout isolation', async () => {
  test.setTimeout(30000);
  const hasContainmentFallback = await sharedPage.evaluate(() => {
    let foundContentVisibility = false;
    let foundContainFallback = false;

    const inspectRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        const cssText = rule.cssText.toLowerCase();
        if (cssText.includes('content-visibility') && cssText.includes('auto')) {
          foundContentVisibility = true;
        }
        if (cssText.includes('contain:') && (cssText.includes('layout') || cssText.includes('strict') || cssText.includes('content'))) {
          foundContainFallback = true;
        }
        if ('cssRules' in rule && (rule as any).cssRules) {
          inspectRules((rule as any).cssRules);
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) inspectRules(sheet.cssRules);
      } catch (e) {
        // Ignore cross-origin sheet security exceptions
      }
    }
    return foundContentVisibility && foundContainFallback;
  });
  
  expect(hasContainmentFallback).toBe(true);
});
