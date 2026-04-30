/// <reference types="node" />
import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';

test.describe('Internal Card Section Alignment Grader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    // Wait for any potential JS-based alignment to settle
    await page.waitForTimeout(500);
  });

  test('The parent container must establish a grid for the cards', async ({ page }) => {
    // Look for a container that holds elements with "card" in their class
    const container = page.locator('.test-card-container, .grid').first();
    await expect(container).toBeVisible();
    
    const display = await container.evaluate(el => window.getComputedStyle(el).display);
    expect(display).toBe('grid');
  });

  test('Card components must use subgrid for row alignment', async ({ page }) => {
    const card = page.locator('.test-card, .card').first();
    await expect(card).toBeVisible();
    
    const gridTemplateRows = await card.evaluate(el => window.getComputedStyle(el).gridTemplateRows);
    // In Chromium, 'subgrid' value for grid-template-rows might include line names like "subgrid [] [] []"
    expect(gridTemplateRows).toMatch(/^subgrid/);
  });

  test('Cards must span the number of rows they intend to inherit', async ({ page }) => {
    const card = page.locator('.test-card, .card').first();
    await expect(card).toBeVisible();
    
    const gridRow = await card.evaluate(el => window.getComputedStyle(el).gridRow);
    // Should contain "span" and at least 2 or 3
    expect(gridRow).toMatch(/span\s+[2-9]/);
  });

  test('Internal sections must have identical heights across sibling cards', async ({ page }) => {
    // Select headers from multiple cards
    const cards = await page.locator('.test-card, .card').all();
    expect(cards.length).toBeGreaterThan(1);

    const header1 = cards[0].locator('.test-card-header, .card-header');
    const header2 = cards[1].locator('.test-card-header, .card-header');

    // Inject DIFFERENT amounts of content into sibling headers.
    // In a subgrid, they should still have identical computed heights (matching the tallest).
    // In a standard flex/grid, they will have different heights.
    await header1.evaluate(el => {
      const spacer = document.createElement('div');
      spacer.style.height = '50px';
      el.appendChild(spacer);
    });
    await header2.evaluate(el => {
      const spacer = document.createElement('div');
      spacer.style.height = '100px';
      el.appendChild(spacer);
    });

    await page.waitForTimeout(100);

    const h1Box = await header1.boundingBox();
    const h2Box = await header2.boundingBox();
    
    expect(h1Box?.height).toBeCloseTo(h2Box?.height || 0, 0);
  });

  test('Alignment must be dynamic and driven by subgrid (not fixed heights)', async ({ page }) => {
    const cards = await page.locator('.test-card, .card').all();
    expect(cards.length).toBeGreaterThan(1);
    
    const header1 = cards[0].locator('.test-card-header, .card-header');
    const header2 = cards[1].locator('.test-card-header, .card-header');
    
    const initialHeight2 = (await header2.boundingBox())?.height || 0;
    
    // Inject tall content into the first header. 
    // We use a large enough value to ensure it becomes the new max height.
    await header1.evaluate(el => {
      const spacer = document.createElement('div');
      spacer.style.height = '400px';
      spacer.className = 'test-spacer';
      el.appendChild(spacer);
    });
    
    // Give time for layout to update
    await page.waitForTimeout(200);
    
    const newHeight2 = (await header2.boundingBox())?.height || 0;
    
    // In subgrid, header 2 MUST grow because header 1 grew, 
    // even though header 2's content didn't change.
    expect(newHeight2).toBeGreaterThan(initialHeight2 + 200);
  });

  test('Should not use fixed height or min-height on internal sections', async ({ page }) => {
    const hasFixedStyles = await page.evaluate(() => {
      const sections = document.querySelectorAll('.test-card-header, .card-header, .test-card-footer, .card-footer');
      const isFixed = (val: string) => val && val !== 'auto' && val !== 'none' && val !== 'normal' && !val.includes('%');
      
      // Check inline styles first
      for (const el of Array.from(sections)) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.height || htmlEl.style.minHeight) return true;
      }
      
      // Check computed style vs content (harder, so we check CSS rules)
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const s = rule.style;
              if (rule.selectorText.includes('header') || rule.selectorText.includes('footer')) {
                if (isFixed(s.height) || isFixed(s.minHeight)) return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    
    expect(hasFixedStyles).toBe(false);
  });

  test('Should not use JavaScript-based height matching', async ({ page }) => {
    // Check for inline height styles on content sections, often a sign of JS matching
    const hasInlineHeights = await page.evaluate(() => {
      const bodies = document.querySelectorAll('.test-card-body, .card-content');
      return Array.from(bodies).some(el => (el as HTMLElement).style.height !== '');
    });
    
    expect(hasInlineHeights).toBe(false);
  });
});
