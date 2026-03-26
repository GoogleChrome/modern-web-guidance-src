import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

// Tests
test.describe(`Optimize image priority Expectations: ${demoName}`, () => {
  // --- STATIC ASSERTIONS ---
  test(`The <img> element for 'hero-lcp.jpg' has the fetchpriority="high" attribute`, () => {
    const img = document.querySelector('img[src*="hero-lcp.jpg"]');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  test(`The <img> element for 'hero-lcp.jpg' does NOT have the loading="lazy" attribute`, () => {
    const img = document.querySelector('img[src*="hero-lcp.jpg"]');
    expect(img?.getAttribute('loading')).not.toBe('lazy');
  });

  test(`The <img> element for 'gallery-alt.jpg' has the fetchpriority="low" attribute`, () => {
    const img = document.querySelector('img[src*="gallery-alt.jpg"]');
    expect(img?.getAttribute('fetchpriority')).toBe('low');
  });

  test(`The <img> element for 'mega-menu-promo.jpg' has the fetchpriority="low" attribute`, () => {
    const img = document.querySelector('img[src*="mega-menu-promo.jpg"]');
    expect(img?.getAttribute('fetchpriority')).toBe('low');
  });

  test(`The <img> element for 'footer-logo.png' does NOT have the fetchpriority attribute`, () => {
    const img = document.querySelector('img[src*="footer-logo.png"]');
    expect(img?.hasAttribute('fetchpriority')).toBe(false);
  });

  test(`No more than two <img> elements on the page have the fetchpriority="high" attribute`, () => {
    const imgs = document.querySelectorAll('img[fetchpriority="high"]');
    expect(imgs.length).toBeLessThanOrEqual(2);
  });

  test(`No <img> elements have the deprecated importance attribute`, () => {
    const imgs = document.querySelectorAll('img[importance]');
    expect(imgs.length).toBe(0);
  });

  // --- BROWSER ASSERTIONS ---
  // Requires browser calculation for "below the fold" coordinate layout
  test.describe('Layout testing', () => {
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

    test(`No image elements located below the fold have the fetchpriority="high" attribute`, async ({ page }) => {
      const belowFoldHighPriorityCount = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img[fetchpriority="high"]'));
        return imgs.filter(img => img.getBoundingClientRect().top >= window.innerHeight).length;
      });
      expect(belowFoldHighPriorityCount).toBe(0);
    });
  });
});
