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

test.describe(`Form Label Alignment Expectations: ${demoName}`, () => {

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

  test('The outer container defines a grid layout', async ({ page }) => {
    const display = await page.evaluate(() => {
      const label = document.querySelector('label');
      const row = label?.parentElement;
      const container = row?.parentElement;
      return container ? window.getComputedStyle(container).display : null;
    });
    expect(display).toBe('grid');
  });

  test('Child elements representing rows use subgrid', async ({ page }) => {
    const usesSubgrid = await page.evaluate(() => {
      const label = document.querySelector('label');
      const row = label?.parentElement;
      if (!row) return false;
      
      const style = window.getComputedStyle(row);
      // Check computed value if supported
      if ((style as any).gridTemplateColumns === 'subgrid') return true;
      
      // Fallback: Check CSS rules for 'subgrid' keyword
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && row.matches(rule.selectorText)) {
              if (rule.style.gridTemplateColumns.includes('subgrid')) return true;
            }
          }
        } catch (e) { }
      }
      return false;
    });
    expect(usesSubgrid).toBe(true);
  });

  test('Alignment is dynamic: labels in different rows respond to each other', async ({ page }) => {
    // 1. Get the initial position of an input in the second row
    const initialInputX = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      return inputs.length > 1 ? inputs[1].getBoundingClientRect().left : 0;
    });

    // 2. Make the first label much longer
    await page.evaluate(() => {
      const firstLabel = document.querySelector('label');
      if (firstLabel) {
        firstLabel.textContent = "This is an extremely long label that should push everything else in a subgrid";
        // Ensure it doesn't wrap to keep the width expansion clear
        (firstLabel as HTMLElement).style.whiteSpace = 'nowrap';
      }
    });

    // 3. Get the new position of the input in the second row
    const finalInputX = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      return inputs.length > 1 ? inputs[1].getBoundingClientRect().left : 0;
    });

    // In a subgrid, the second row's input MUST move because the first column expanded
    // In a flex or fixed-width layout, it won't move.
    expect(finalInputX).toBeGreaterThan(initialInputX + 10);
  });

  test('Labels do not have hardcoded fixed widths', async ({ page }) => {
    const hasFixed = await page.evaluate(() => {
      const label = document.querySelector('label');
      if (!label) return false;
      
      // Check for fixed width in CSS rules
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && label.matches(rule.selectorText)) {
              const w = rule.style.width || rule.style.minWidth;
              if (w && (w.includes('px') || w.includes('rem') || w.includes('em')) && !w.includes('auto')) return true;
            }
          }
        } catch (e) { }
      }
      return false;
    });
    expect(hasFixed).toBe(false);
  });

  test('Row containers are part of the grid system, not flexbox', async ({ page }) => {
    const isFlex = await page.evaluate(() => {
      const label = document.querySelector('label');
      const row = label?.parentElement;
      return row ? window.getComputedStyle(row).display === 'flex' : false;
    });
    expect(isFlex).toBe(false);
  });

  test('Row containers do not define their own column tracks', async ({ page }) => {
    const hasOwnTracks = await page.evaluate(() => {
      const label = document.querySelector('label');
      const row = label?.parentElement;
      if (!row) return true;

      // It must be a grid to pass this part of the requirement (implied by "Must pass")
      if (window.getComputedStyle(row).display !== 'grid') return true;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && row.matches(rule.selectorText)) {
              const gtc = rule.style.gridTemplateColumns;
              // If it defines explicit tracks instead of subgrid
              if (gtc && !gtc.includes('subgrid') && gtc.trim() !== '') return true;
            }
          }
        } catch (e) { }
      }
      return false;
    });
    expect(hasOwnTracks).toBe(false);
  });

});
