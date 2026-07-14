import { test, expect, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) throw new Error('TARGET_FILE environment variable not set.');

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Helper: robust ancestor check leveraging Playwright's auto-retrying locators
async function waitForErrorState(page: any, formField: Locator, expectRed: boolean) {
  await expect(async () => {
    const isRed = await formField.evaluate((el: HTMLElement) => {
      let current = el.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const colors = [style.borderColor, style.borderLeftColor, style.backgroundColor, style.color];
        for (const color of colors) {
          const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) {
            const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
            if (r > g + 40 && r > b + 40) return true; // It's red-ish
          }
        }
        current = current.parentElement;
      }
      return false;
    });
    expect(isRed).toBe(expectRed);
  }).toPass({ timeout: 2000 });
}

test.describe(`Style parent with :has() Expectations: ${demoName}`, () => {
  // Static checks
  test('Static: Implementation must use JS class toggling for fallback if JS fallback is implemented', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFallbackScript = html.includes('<script>') && (html.includes('supports') || html.includes('querySelector'));
    if (hasFallbackScript) {
      expect(html).toMatch(/classList\.(toggle|add|remove)/);
    } else {
      expect(true).toBe(true);
    }
  });

  // Browser tests
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
      if (fs.existsSync(localFilePath)) await route.fulfill({ path: localFilePath });
      else await route.continue();
    });
    await page.goto(demoUrl);
  });

  const runInteractionTests = () => {
    test('On page load, ancestor container should have neutral styling', async ({ page }) => {
      const input = page.locator('input[required]').first();
      await waitForErrorState(page, input, false);
    });

    test('Invalid interaction must trigger error state on a parent container', async ({ page }) => {
      const input = page.locator('input[required]').first();
      await waitForErrorState(page, input, false); // initial
      await input.fill('a');
      await input.fill('');
      await input.blur();
      await waitForErrorState(page, input, true); // should turn red!
    });

    test('Correcting the input must revert parent to neutral state', async ({ page }) => {
      const input = page.locator('input[required]').first();
      await input.fill('a');
      await input.fill('');
      await input.blur();
      await waitForErrorState(page, input, true); // triggered
      
      await input.fill('valid@example.com');
      await input.blur();
      await waitForErrorState(page, input, false); // cleared
    });
  };

  test.describe('Native Mode Tests', () => {
    runInteractionTests();
  });

  test.describe('Fallback Mode Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        const originalSupports = CSS.supports;
        CSS.supports = function(this: any, ...args: any[]) {
          if (args[0] === 'selector(:user-invalid)') return false;
          return originalSupports.apply(this, args as any);
        } as any;
      });
      // Click fallback checkbox if available
      const fallbackCheckbox = page.locator('input[type="checkbox"]#force-fallback');
      if (await fallbackCheckbox.count() > 0) {
        await fallbackCheckbox.check();
      }
    });
    runInteractionTests();
  });
});
