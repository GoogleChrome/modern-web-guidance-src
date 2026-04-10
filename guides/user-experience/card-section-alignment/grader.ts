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

test.describe(`Card Section Alignment Expectations: ${demoName}`, () => {

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

  test('Card component applies grid-template-rows: subgrid or grid-template-columns: subgrid', async ({ page }) => {
    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
    
    const subgridApplied = await cards.first().evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateRows.startsWith('subgrid') || 
             style.gridTemplateColumns.startsWith('subgrid');
    });
    
    expect(subgridApplied).toBe(true);
  });

  test('Internal sections of adjacent cards stay synchronized in height and position', async ({ page }) => {
    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
    
    // Ensure the container is actually using grid to achieve this
    const display = await cards.first().evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('grid');

    const card1 = cards.nth(0);
    const card2 = cards.nth(1);
    const card1Children = await card1.locator('> *').all();
    const card2Children = await card2.locator('> *').all();
    const minLength = Math.min(card1Children.length, card2Children.length);

    for (let i = 0; i < minLength; i++) {
      const box1 = await card1Children[i].boundingBox();
      const box2 = await card2Children[i].boundingBox();
      if (box1 && box2) {
        expect(Math.abs(box1.y - box2.y)).toBeLessThan(2);
        expect(Math.abs(box1.height - box2.height)).toBeLessThan(2);
      }
    }
  });

  test('Parent grid defines multiple tracks explicitly consumed by child cards', async ({ page }) => {
    const container = page.locator('.container, [class*="container"], body > div').first();
    await expect(container).toBeVisible();
    
    const hasTracks = await container.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateRows.split(' ').length > 1 || 
             style.gridTemplateColumns.split(' ').length > 1;
    });
    expect(hasTracks).toBe(true);

    const cards = page.locator('.card, [class*="card"]');
    const spansTracks = await cards.first().evaluate(el => {
      const style = window.getComputedStyle(el);
      const isSpan = (val: string) => val.includes('span') || (parseInt(val) > 1);
      return isSpan(style.gridRowEnd) || isSpan(style.gridColumnEnd) || 
             isSpan(style.gridRowStart) || isSpan(style.gridColumnStart);
    });
    expect(spansTracks).toBe(true);
  });

  test('Implementation does not rely on JavaScript for uniform heights', async ({ page }) => {
    // Trigger a resize to see if JS kicks in
    await page.setViewportSize({ width: 500, height: 500 });
    await page.waitForTimeout(200);

    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
    const internalSections = cards.first().locator('> *');
    const counts = await internalSections.count();
    
    for (let i = 0; i < counts; i++) {
      const hasInlineStyle = await internalSections.nth(i).evaluate(el => {
        return (el as HTMLElement).style.height !== '' || (el as HTMLElement).style.minHeight !== '';
      });
      expect(hasInlineStyle).toBe(false);
    }
  });

  test('Internal sections do not use min-height or fixed height for visual alignment', async ({ page }) => {
    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
    const section = cards.first().locator('> *').first();
    
    const originalBox = await section.boundingBox();
    const originalHeight = originalBox?.height || 0;
    expect(originalHeight).toBeGreaterThan(0);

    await section.evaluate(el => {
      const div = document.createElement('div');
      div.style.height = '200px';
      el.appendChild(div);
    });
    
    const newBox = await section.boundingBox();
    const newHeight = newBox?.height || 0;
    
    // In subgrid, adding content should grow the track. 
    // In fixed height or flex with fixed height, it won't grow to accommodate the 200px.
    expect(newHeight).toBeGreaterThan(originalHeight + 150); 
  });

  test('Card components do not define independent internal grid tracks', async ({ page }) => {
    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
    
    const display = await cards.first().evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('grid');

    const result = await cards.first().evaluate(el => {
      const style = window.getComputedStyle(el);
      const rows = style.gridTemplateRows;
      const cols = style.gridTemplateColumns;
      const isIndependent = (val: string) => {
        if (val === 'none' || val.startsWith('subgrid')) return false;
        // If it contains a list of tracks like "80px 150px 50px"
        return val.includes(' ');
      };
      return isIndependent(rows) || isIndependent(cols);
    });
    expect(result).toBe(false);
  });
});
