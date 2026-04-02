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

test.describe(`Dynamic Sibling Styling Expectations: ${demoName}`, () => {
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

  test('The implementation uses sibling-index() and sibling-count() in CSS', async () => {
    expect(html).toContain('sibling-index()');
    expect(html).toContain('sibling-count()');
  });

  test('A fallback strategy is provided with CSS variables and CSS.supports() check', async () => {
    // Check for variables usage in CSS (either --index/--count or --sibling-index/--sibling-count)
    expect(html).toMatch(/var\(--(sibling-)?index\)/);
    expect(html).toMatch(/var\(--(sibling-)?count\)/);
    // Check for JS fallback with CSS.supports (flexible regex)
    expect(html).toContain('CSS.supports');
    expect(html).toMatch(/CSS\.supports\([^)]*sibling-(index|count)/);
  });

  test('The JavaScript fallback injects 1-based index and correct count', async ({ page }) => {
    // Force the fallback to run by mocking CSS.supports to return false for sibling-index
    await page.addInitScript(() => {
      const originalSupports = window.CSS.supports;
      (window as any).CSS.supports = function(condition: any, value: any) {
        const conditionString = String(condition);
        const valueString = String(value);
        // Robust check: if any argument contains sibling-index or sibling-count, return false to force fallback
        if (/sibling-(index|count)/.test(conditionString) || /sibling-(index|count)/.test(valueString)) {
          return false;
        }
        return originalSupports.apply(this, [condition, value] as any);
      };
    });

    await page.reload();

    const result = await page.evaluate(() => {
      // Find elements that should have variables (e.g., .swatch or list items)
      const items = Array.from(document.querySelectorAll('li, .swatch, .item, .dynamic-list > *, .swatch-container > *, .swatch-item'));
      if (items.length === 0) return { error: 'No items found' };

      // Find an item that actually has the inline styles
      const itemWithStyles = items.find(el => (el as HTMLElement).style.getPropertyValue('--sibling-index') || (el as HTMLElement).style.getPropertyValue('--index'));
      if (!itemWithStyles) return { error: 'No item with inline styles found' };

      const item = itemWithStyles as HTMLElement;
      const index = item.style.getPropertyValue('--sibling-index').trim() || item.style.getPropertyValue('--index').trim();
      const count = item.style.getPropertyValue('--sibling-count').trim() || item.style.getPropertyValue('--count').trim();
      
      return {
        firstIndex: parseInt(index),
        firstCount: parseInt(count),
        totalItems: items.length
      };
    });

    expect(result.firstIndex).toBe(1); // Expect 1-based indexing
    expect(result.firstCount).toBeGreaterThan(0);
  });

  test('The JavaScript fallback is conditional and does NOT run if native support exists', async ({ page }) => {
    // Force CSS.supports to return true
    await page.addInitScript(() => {
      const originalSupports = window.CSS.supports;
      (window as any).CSS.supports = function(conditionString: string, value: any) {
        const cond = String(conditionString);
        const val = String(value);
        if (/sibling-(index|count)/.test(cond) || /sibling-(index|count)/.test(val)) {
          return true;
        }
        return originalSupports.apply(this, arguments as any);
      };
    });

    await page.reload();

    const hasVariable = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('li, .swatch, .item, .dynamic-list > *, .swatch-container > *, .swatch-item'));
      return items.some(el => (el as HTMLElement).style.getPropertyValue('--sibling-index').trim() || (el as HTMLElement).style.getPropertyValue('--index').trim());
    });

    expect(hasVariable).toBe(false); // Expect NO inline variable when native support exists
  });

  test('CSS structure overrides variables with native functions inside @supports', async () => {
    // Strictly require @supports check for the override pattern
    const minifiedHtml = html.replace(/\s+/g, ' ');
    const hasSupportsOverride = /@supports[^{]*sibling-(index|count)\(\)[^{]*\{[^}]*--[a-z-]+\s*:\s*sibling-(index|count)\(\)/.test(minifiedHtml);
    expect(hasSupportsOverride).toBe(true);
  });

  test('Conditional: Symmetrical effects use midpoint calculation', async () => {
    // Only check if rotation or fanning is implemented
    if (html.includes('rotate') || html.includes('skew')) {
      const hasMidpoint = /sibling-count\(\)\s*\+\s*1\s*\)\s*\/\s*2/.test(html);
      expect(hasMidpoint).toBe(true);
    }
  });

  test('Conditional: Circular positioning uses trigonometry', async () => {
    // Only check if circular positioning is suggested (e.g., using sin/cos)
    if (html.includes('sin(') || html.includes('cos(')) {
      const usesSiblingFunctions = /sin\([^)]*sibling-(count|index)/.test(html) || /cos\([^)]*sibling-(count|index)/.test(html);
      expect(usesSiblingFunctions).toBe(true);
    }
  });
});
