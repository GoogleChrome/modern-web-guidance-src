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

test.describe(`Nested Content Alignment (Subgrid) Expectations: ${demoName}`, () => {

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

  test('Should use "subgrid" for grid-template-columns or grid-template-rows', async ({ page }) => {
    const hasSubgrid = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });
    });
    expect(hasSubgrid, 'No element found using the "subgrid" keyword in grid-template-columns or grid-template-rows').toBe(true);
  });

  test('Should establish a nested grid context with "display: grid" on the subgridded element', async ({ page }) => {
    const isGridAndSubgrid = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        const isSubgrid = style.gridTemplateColumns.includes('subgrid') || 
                          style.gridTemplateRows.includes('subgrid');
        const isGrid = style.display === 'grid' || style.display === 'inline-grid';
        return isSubgrid && isGrid;
      });
    });
    expect(isGridAndSubgrid, 'The element using "subgrid" must also have "display: grid" to establish a nested context').toBe(true);
  });

  test('Should maintain a hierarchical/nested HTML structure (not flattened)', async ({ page }) => {
    const isNested = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      // A nested grid structure means a grid container has a child that is also a grid container
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        const isGrid = style.display === 'grid' || style.display === 'inline-grid';
        if (!isGrid) return false;
        
        const children = Array.from(el.children);
        return children.some(child => {
          const childStyle = window.getComputedStyle(child);
          return childStyle.display === 'grid' || childStyle.display === 'inline-grid';
        });
      });
    });
    expect(isNested, 'The document structure is flattened; nested elements should be children of a logical container').toBe(true);
  });

  test('Subgridded elements should contain logical child elements', async ({ page }) => {
    const hasChildren = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const subgrids = allElements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });
      
      if (subgrids.length === 0) return false;
      return subgrids.every(el => el.children.length > 0);
    });
    expect(hasChildren, 'Subgridded containers should contain nested elements to align with the parent grid').toBe(true);
  });

  test('Should not use manual track mirroring (e.g., 1fr, px) for alignment', async ({ page }) => {
    const noManualMirror = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Find elements that are nested containers (children of a grid, and themselves grids)
      const nestedGrids = allElements.filter(el => {
        const parent = el.parentElement;
        if (!parent) return false;
        const parentStyle = window.getComputedStyle(parent);
        const elStyle = window.getComputedStyle(el);
        return (parentStyle.display === 'grid' || parentStyle.display === 'inline-grid') &&
               (elStyle.display === 'grid' || elStyle.display === 'inline-grid');
      });

      if (nestedGrids.length === 0) return false;

      // Every nested grid that spans multiple rows/cols should use subgrid if it contains content that needs alignment
      return nestedGrids.every(el => {
        const style = window.getComputedStyle(el);
        const rowSpan = style.gridRowEnd.includes('span') || (style.gridRowStart !== 'auto' && style.gridRowEnd !== 'auto');
        const colSpan = style.gridColumnEnd.includes('span') || (style.gridColumnStart !== 'auto' && style.gridColumnEnd !== 'auto');
        
        // If it spans tracks, it should prefer subgrid over manual tracks
        if (rowSpan || colSpan) {
            return style.gridTemplateRows.includes('subgrid') || style.gridTemplateColumns.includes('subgrid');
        }
        return true;
      });
    });
    expect(noManualMirror, 'The solution uses manual track mirroring or misses subgrid on nested containers').toBe(true);
  });

  test('Should not use absolute positioning for grid alignment', async ({ page }) => {
    const noAbsolutePositioning = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Prerequisite: must have subgrid
      const hasSubgrid = allElements.some(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });
      if (!hasSubgrid) return false;

      // Check if any element that is part of the grid layout uses absolute positioning
      return !allElements.some(el => {
        const style = window.getComputedStyle(el);
        const isAbsolute = style.position === 'absolute' || style.position === 'fixed';
        // Only care if it's within a grid context
        const parent = el.parentElement;
        const parentStyle = parent ? window.getComputedStyle(parent) : null;
        const inGrid = parentStyle && (parentStyle.display === 'grid' || parentStyle.display === 'inline-grid');
        return isAbsolute && inGrid;
      });
    });
    expect(noAbsolutePositioning, 'The implementation uses absolute positioning for alignment instead of subgrid').toBe(true);
  });

});
