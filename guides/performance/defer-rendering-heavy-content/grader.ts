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

test.describe(`defer-rendering-heavy-content Expectations: ${demoName}`, () => {

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
    // Wait for the app's async rendering
    await page.waitForSelector('.card', { state: 'attached', timeout: 5000 }).catch(() => { });
  });

  // 1. Cards with class name `.off-screen-card` must be outside the initial viewport.
  test('Cards with class name `.off-screen-card` must be outside the initial viewport', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const isOutside = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= window.innerHeight || rect.bottom <= 0;
      });
    });

    expect(isOutside, 'All .off-screen-card elements must be outside the initial viewport').toBe(true);
  });

  // 2. Cards with class name `.off-screen-card` must set `content-visibility: auto`.
  test('Cards with class name `.off-screen-card` must set `content-visibility: auto`', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const hasContentVisibilityAuto = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
    });

    expect(hasContentVisibilityAuto, 'All .off-screen-card elements must have content-visibility: auto').toBe(true);
  });

  // 3. Cards with class name `.off-screen-card` must set `contain-intrinsic-size`.
  test('Cards with class name `.off-screen-card` must set `contain-intrinsic-size`', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const hasContainIntrinsicSize = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const style = window.getComputedStyle(el);
        return style.containIntrinsicSize !== 'none' && style.containIntrinsicSize !== '';
      });
    });

    expect(hasContainIntrinsicSize, 'All .off-screen-card elements must have contain-intrinsic-size set').toBe(true);
  });

  // 4. The `.debug-panel` must be hidden using `content-visibility: hidden`.
  test('The `.debug-panel` must be hidden using `content-visibility: hidden`', async ({ page }) => {
    const panel = page.locator('.debug-panel');
    await expect(panel, 'Missing .debug-panel element').toBeAttached();

    const isHidden = await panel.evaluate(el => window.getComputedStyle(el).contentVisibility === 'hidden');
    expect(isHidden, '.debug-panel must be hidden using content-visibility: hidden').toBe(true);
  });

  // 5. The `debug-panel` must use a fallback strategy for unsupported browsers.
  test('The `debug-panel` must use a fallback strategy for unsupported browsers', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasCSSFeatureDetection = /@supports\s*(?:not\s*)?\(\s*content-visibility\s*:\s*hidden\s*\)/.test(html);
    expect(hasCSSFeatureDetection, 'Missing CSS feature detection for content-visibility: hidden').toBe(true);
  });

  // 6. The `.sidebar-text` must be hidden using `hidden="until-found"`.
  test('The `.sidebar-text` must be hidden using `hidden="until-found"`', async ({ page }) => {
    const sidebar = page.locator('.sidebar-text');
    const count = await sidebar.count();
    expect(count, 'Expected at least one element with class sidebar-text').toBeGreaterThan(0);

    const hasHiddenUntilFound = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.sidebar-text'));
      return els.every(el => el.getAttribute('hidden') === 'until-found');
    });

    expect(hasHiddenUntilFound, '.sidebar-text elements must use hidden="until-found"').toBe(true);
  });

  // 7. The `.sidebar-text` must not have any `display` or `visibility` CSS properties applied to it directly.
  test('The `.sidebar-text` must not have any `display` or `visibility` CSS properties applied to it directly', async ({ page }) => {
    const sidebar = page.locator('.sidebar-text');
    const count = await sidebar.count();
    expect(count, 'Expected at least one element with class sidebar-text').toBeGreaterThan(0);

    const isHiddenIncorrectly = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.sidebar-text'));
      return els.some(el => {
        const origHidden = el.getAttribute('hidden');
        el.removeAttribute('hidden');
        const style = window.getComputedStyle(el);
        const isHiddenViaCSS = style.display === 'none' || style.visibility === 'hidden';
        if (origHidden) el.setAttribute('hidden', origHidden);
        return isHiddenViaCSS;
      });
    });

    expect(isHiddenIncorrectly, '.sidebar-text must not be visually hidden via CSS overrides').toBe(false);
  });

  // 8. The `.sidebar-text` `aria-expanded` attribute must stay in sync with the `hidden` attribute using a `beforematch` event listener.
  test('The `.sidebar-text` `aria-expanded` attribute must stay in sync with the `hidden` attribute', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasBeforeMatchListener = html.includes('beforematch') || html.includes('onbeforematch');
    expect(hasBeforeMatchListener, 'Missing beforematch event listener for .sidebar-text UI synchronization').toBe(true);

    const hasAriaExpanded = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.sidebar-text'));
      return els.every(el => el.getAttribute('aria-expanded') === 'false' && el.getAttribute('hidden') === 'until-found');
    });
    expect(hasAriaExpanded, '.sidebar-text elements must have aria-expanded attribute').toBe(true);

    await page.click('.card:nth-of-type(1)');
    // await page.waitForTimeout(1000);
    const isExpanded = await page.evaluate(() => {
      const card = document.querySelector('.sidebar-text:nth-of-type(1)');
      return card?.getAttribute('aria-expanded') === 'true';
    });
    expect(isExpanded, '.sidebar-text elements must have aria-expanded attribute set to true when the content is revealed').toBe(true);
  });

  // 9. The `sidebar-text` must use a fallback strategy for unsupported browsers.
  test('The `sidebar-text` must use a fallback strategy for unsupported browsers', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = html.includes('onbeforematch') && html.includes('in HTMLElement.prototype');
    expect(hasFeatureDetection, 'Missing explicit fallback strategy or feature detection for beforematch').toBe(true);
  });

});
