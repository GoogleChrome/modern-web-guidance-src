import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Dynamic Sibling Styling Expectations: ${demoName}`, () => {
  let fileContent: string;

  test.beforeAll(() => {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  });

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
  });

  test('Implementation uses sibling-index() and sibling-count() native functions', async () => {
    expect(fileContent).toMatch(/sibling-index\s*\(/);
    expect(fileContent).toMatch(/sibling-count\s*\(/);
  });

  test('Provides a JavaScript fallback strategy that injects 1-based --sibling-index and --sibling-count', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSupports = CSS.supports;
      CSS.supports = function(condition) {
        if (condition.includes('sibling-index')) return false;
        return originalSupports.apply(this, arguments as any);
      };
    });
    
    await page.goto(demoUrl);
    
    const checkFallback = async (selector: string) => {
      const properties = await page.evaluate((sel) => {
        const items = document.querySelectorAll(sel);
        return Array.from(items).map(item => ({
          jsIndex: (item as HTMLElement).style.getPropertyValue('--sibling-index').trim(),
          jsCount: (item as HTMLElement).style.getPropertyValue('--sibling-count').trim()
        }));
      }, selector);
      
      expect(properties.length).toBeGreaterThan(0);
      expect(properties[0].jsIndex).toBe('1');
      expect(properties[0].jsCount).toBe(properties.length.toString());
    };

    await checkFallback('.spectrum-card');
    await checkFallback('.fan-card');
    await checkFallback('.circle-orb');
  });

  test('JavaScript fallback is conditionally executed using CSS.supports() feature detection', async ({ page }) => {
    await page.goto(demoUrl);
    
    const properties = await page.evaluate(() => {
      const items = document.querySelectorAll('.spectrum-card, .fan-card, .circle-orb');
      return Array.from(items).map(item => (item as HTMLElement).style.getPropertyValue('--sibling-index').trim());
    });
    
    expect(properties.length).toBeGreaterThan(0);
    expect(properties[0]).toBe('');
  });

  test('CSS overrides custom properties with native functions inside @supports block', async ({ page }) => {
    await page.goto(demoUrl);
    const computed = await page.evaluate(() => {
      const item = document.querySelector('.spectrum-card');
      if (!item) return null;
      return window.getComputedStyle(item).getPropertyValue('--index').trim();
    });
    
    expect(computed).toContain('sibling-index');
  });

  test('Calculates proportions or distributions dynamically', async ({ page }) => {
    await page.goto(demoUrl);
    
    const getStyles = () => page.evaluate(() => {
      const item = document.querySelector('.spectrum-card');
      if (!item) return null;
      const style = window.getComputedStyle(item);
      return {
        width: style.width,
        backgroundColor: style.backgroundColor,
        transform: style.transform
      };
    });
    
    const before = await getStyles();
    expect(before).not.toBeNull();
    
    await page.evaluate(() => {
      const item = document.querySelector('.spectrum-card');
      if (item && item.parentElement) {
        item.parentElement.appendChild(item.cloneNode(true));
      }
    });
    
    await page.waitForTimeout(100);
    
    const after = await getStyles();
    
    const hasDynamicChange = 
      before!.width !== after!.width ||
      before!.backgroundColor !== after!.backgroundColor ||
      before!.transform !== after!.transform;
      
    expect(hasDynamicChange).toBe(true);
  });

  test('Implements symmetrical midpoint calculation AND circular trigonometry', async () => {
    const hasMidpoint = /\+\s*1/.test(fileContent) && /\/\s*2/.test(fileContent);
    const hasTrig = /sin\s*\(/.test(fileContent) && /cos\s*\(/.test(fileContent);
    
    expect(hasMidpoint).toBe(true);
    expect(hasTrig).toBe(true);
  });
});
