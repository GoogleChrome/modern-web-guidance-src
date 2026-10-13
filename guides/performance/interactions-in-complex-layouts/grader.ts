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
    const url = new URL(route.request().url());
    let reqPath = decodeURIComponent(url.pathname);
    if (reqPath === '/' || reqPath === '') reqPath = `/${demoName}`;
    const fullPath = path.join(targetDir, reqPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType =
        ext === '.html' ? 'text/html' :
        ext === '.css' ? 'text/css' :
        ext === '.js' || ext === '.mjs' ? 'application/javascript' :
        'application/octet-stream';
      await route.fulfill({
        status: 200,
        contentType,
        body: fs.readFileSync(fullPath),
      });
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
    const candidates = Array.from(
      document.querySelectorAll('.list, .board-column, [class*="column"], .card, [class*="card"]')
    );
    if (candidates.length === 0) throw new Error('Could not find column or card elements');
    const autoEl = candidates.find((el) => window.getComputedStyle(el).contentVisibility === 'auto');
    if (autoEl) return 'auto';

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule && /(\.list|\.board-column|column|\.card)/i.test(rule.selectorText)) {
            const baseSelector = rule.selectorText.replace(/:nth-[a-z-]+\([^)]+\)/gi, '').trim() || '*';
            let matchesBaseDom = false;
            try {
              matchesBaseDom = document.querySelector(baseSelector) !== null;
            } catch {}
            if (matchesBaseDom && rule.style.getPropertyValue('content-visibility').trim() === 'auto') {
              return 'auto';
            }
          }
        }
      } catch {
        // Ignore cross-origin stylesheet errors
      }
    }
    return window.getComputedStyle(candidates[0]).contentVisibility;
  });
  
  expect(contentVisibility).toBe('auto');
});

test('Target column elements must have a non-zero contain-intrinsic-size specified', async () => {
  test.setTimeout(30000);
  const hasNonZeroSize = await sharedPage.evaluate(() => {
    const isValidIntrinsicSize = (size: string) => {
      if (!size || size === 'none' || size === 'normal') return false;
      const numbers = size.match(/\d+/g);
      if (!numbers) return false;
      return !numbers.every(n => parseInt(n, 10) === 0);
    };

    const candidates = Array.from(
      document.querySelectorAll('.list, .board-column, [class*="column"], .card, [class*="card"]')
    );
    if (candidates.some((el) => {
      const styles = window.getComputedStyle(el);
      const size = styles.getPropertyValue('contain-intrinsic-size') || styles.containIntrinsicSize || '';
      return isValidIntrinsicSize(size);
    })) {
      return true;
    }

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule && /(\.list|\.board-column|column|\.card)/i.test(rule.selectorText)) {
            const baseSelector = rule.selectorText.replace(/:nth-[a-z-]+\([^)]+\)/gi, '').trim() || '*';
            let matchesBaseDom = false;
            try {
              matchesBaseDom = document.querySelector(baseSelector) !== null;
            } catch {}
            const size = rule.style.getPropertyValue('contain-intrinsic-size') ||
                         rule.style.getPropertyValue('contain-intrinsic-height') ||
                         rule.style.getPropertyValue('contain-intrinsic-block-size') ||
                         rule.cssText.match(/contain-intrinsic-[a-z-]+\s*:\s*([^;}\n]+)/i)?.[1] || '';
            if (matchesBaseDom && isValidIntrinsicSize(size.trim())) {
              return true;
            }
          }
        }
      } catch {
        // Ignore cross-origin stylesheet errors
      }
    }
    return false;
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
