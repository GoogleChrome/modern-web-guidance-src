import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Grader for Form Field Wrapper Alignment using CSS Subgrid.
 * 
 * Verifies that:
 * 1. A parent grid container exists for field rows.
 * 2. Field wrappers use CSS Subgrid.
 * 3. Labels and inputs align across rows within the same grid.
 * 4. No legacy layout methods (tables, display: contents, fixed widths) are used.
 */

const targetFile = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const targetUrl = `file://${targetFile}`;

test.describe('Form Field Wrapper Alignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(targetUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Parent container must define a multi-column grid layout for multiple field rows', async ({ page }) => {
    const hasGridParent = await page.evaluate(() => {
      const grids = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'grid' || style.display === 'inline-grid';
      });

      return grids.some(grid => {
        const style = window.getComputedStyle(grid);
        // Extract column tracks and filter out line names
        const tracks = style.gridTemplateColumns.split(' ').filter(t => t !== '[]' && t !== '').length;
        // A valid parent grid should have at least 2 wrappers as children
        const wrappers = Array.from(grid.children).filter(child => {
          return child.querySelector('label') && (child.querySelector('input') || child.querySelector('select') || child.querySelector('textarea'));
        });
        return tracks >= 2 && wrappers.length >= 2;
      });
    });
    expect(hasGridParent, 'Should find a grid parent containing multiple field wrappers').toBe(true);
  });

  test('All field wrappers must use grid-template-columns: subgrid', async ({ page }) => {
    const allWrappersUseSubgrid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      const wrappers = labels.map(l => l.parentElement).filter(Boolean) as HTMLElement[];
      return wrappers.length > 0 && wrappers.every(w => {
        const style = window.getComputedStyle(w);
        // Computed style for subgrid starts with 'subgrid' and may include empty line names
        return style.gridTemplateColumns.startsWith('subgrid');
      });
    });
    expect(allWrappersUseSubgrid, 'Every field wrapper must adopt the parent grid tracks using subgrid').toBe(true);
  });

  test('Labels must be horizontally aligned across rows within the same parent grid', async ({ page }) => {
    const alignedInSameGrid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length < 2) return false;
      
      const getOuterGridParent = (el: HTMLElement) => {
        let p = el.parentElement;
        let lastGrid = null;
        while (p) {
          const style = window.getComputedStyle(p);
          if (style.display === 'grid' || style.display === 'inline-grid') {
              lastGrid = p;
          }
          p = p.parentElement;
        }
        return lastGrid;
      };
      
      const firstGrid = getOuterGridParent(labels[0]);
      if (!firstGrid) return false;
      
      // All labels should share the same outermost ancestor grid
      const shareAncestor = labels.every(l => getOuterGridParent(l) === firstGrid);
      const xPositions = labels.map(l => Math.round(l.getBoundingClientRect().left));
      const uniqueX = new Set(xPositions);
      
      // Alignment check: unique X positions should be limited to 1 or 2 (multi-column)
      return shareAncestor && uniqueX.size > 0 && uniqueX.size <= 2;
    });
    expect(alignedInSameGrid, 'Labels must share a common grid ancestor and align to the same column offsets').toBe(true);
  });

  test('The layout must not use table-based structures for form alignment', async ({ page }) => {
    const noTables = await page.evaluate(() => {
      const hasTableTag = document.querySelector('table') !== null;
      const hasAnyTableDisplay = Array.from(document.querySelectorAll('*')).some(el => {
        const display = window.getComputedStyle(el).display;
        return display.startsWith('table');
      });
      return !hasTableTag && !hasAnyTableDisplay;
    });
    expect(noTables, 'Should not use <table> elements or table-related display properties').toBe(true);
  });

  test('Field wrappers must not use display: contents', async ({ page }) => {
    const noContents = await page.evaluate(() => {
      return !Array.from(document.querySelectorAll('*')).some(el => {
        return window.getComputedStyle(el).display === 'contents';
      });
    });
    expect(noContents, 'Should avoid display: contents due to accessibility concerns').toBe(true);
  });

  test('Labels must not use fixed pixel widths to simulate alignment', async ({ page }) => {
    const noFixedWidth = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      
      return labels.every(l => {
        const wrapper = l.parentElement;
        if (!wrapper) return false;
        
        // If subgrid is correctly used, we consider the width flexible
        if (window.getComputedStyle(wrapper).gridTemplateColumns.startsWith('subgrid')) return true;
        
        // Check if width is fixed by observing reaction to text change
        const originalWidth = l.getBoundingClientRect().width;
        const originalText = l.textContent;
        l.textContent = "A significantly longer label text to test for fixed-width alignment simulation";
        const newWidth = l.getBoundingClientRect().width;
        l.textContent = originalText;
        
        // A flexible label should expand significantly with longer text
        return Math.abs(originalWidth - newWidth) > 5;
      });
    });
    expect(noFixedWidth, 'Labels must have flexible widths determined by the grid, not fixed pixel values').toBe(true);
  });
});
