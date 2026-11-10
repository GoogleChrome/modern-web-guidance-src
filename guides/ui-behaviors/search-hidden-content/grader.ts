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

test.describe(`Search Hidden Content Expectations: ${demoName}`, () => {
  
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

  test('The wholesale-tab elements use the <details> element', async ({ page }) => {
    const tabs = page.locator('.wholesale-tab');
    const count = await tabs.count();
    expect(count, 'Expected at least one element with class wholesale-tab').toBeGreaterThan(0);

    const isUsingDetails = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.wholesale-tab'));
      return els.every(el => el.tagName === 'DETAILS' || el.closest('details') !== null || el.querySelector('details') !== null);
    });

    expect(isUsingDetails, 'wholesale-tab regions must utilize the <details> element').toBe(true);
  });

  test('The <details> mutually exclusive regions share a name attribute', async ({ page }) => {
    const names = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.wholesale-tab'));
      return els.map(el => {
        const details = el.tagName === 'DETAILS' ? el : (el.closest('details') || el.querySelector('details'));
        return details ? details.getAttribute('name') : null;
      });
    });

    expect(names.length, 'At least one wholesale-tab must exist').toBeGreaterThan(0);
    expect(names.every(n => n !== null), 'All wholesale-tabs must have a name attribute').toBe(true);
    if (names.length > 1) {
      expect(names.every(n => n === names[0]), 'All wholesale-tabs must share the identical name attribute for mutual exclusivity').toBe(true);
    }
  });

  test('The coupon-panel uses the hidden="until-found" attribute', async ({ page }) => {
    const panel = page.locator('#coupon-panel');
    await expect(panel, 'Missing #coupon-panel element').toBeAttached();
    
    const hasAttribute = await panel.evaluate(el => el.getAttribute('hidden') === 'until-found');
    expect(hasAttribute, '#coupon-panel must use hidden="until-found"').toBe(true);
  });

  test('The coupon-panel does not have display: none or visibility: hidden', async ({ page }) => {
    const isHiddenIncorrectly = await page.evaluate(() => {
      const el = document.getElementById('coupon-panel');
      if (!el) return false;
      
      const origHidden = el.getAttribute('hidden');
      el.removeAttribute('hidden');
      const style = window.getComputedStyle(el);
      const isHiddenViaCSS = style.display === 'none' || style.visibility === 'hidden';
      
      if (origHidden) el.setAttribute('hidden', origHidden);
      return isHiddenViaCSS;
    });

    expect(isHiddenIncorrectly, '#coupon-panel must not be visually hidden via CSS overrides').toBe(false);
  });

  test('The coupon-panel does not hide sensitive information', async ({ page }) => {
    const hasSensitiveInfo = await page.evaluate(() => {
      const el = document.getElementById('coupon-panel');
      if (!el) return false;
      const text = el.textContent || '';
      return /(ADMIN_TOKEN|AX-992)/i.test(text);
    });
    
    expect(hasSensitiveInfo, 'Sensitive info found in #coupon-panel').toBe(false);
  });

  test('State is synchronized using a beforematch event listener', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasBeforeMatchListener = html.includes('beforematch') || html.includes('onbeforematch');
    expect(hasBeforeMatchListener, 'Missing beforematch event listener for UI synchronization').toBe(true);
  });

  test('Implementation includes explicit fallback strategy with feature detection', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = /['"`]onbeforematch['"`]\s+in\s+/.test(html) || /typeof\s+[\w.]+\.onbeforematch\s*[!=]==?/.test(html);
    expect(hasFeatureDetection, 'Missing explicit fallback strategy or feature detection for unsupported browsers').toBe(true);
  });
});
