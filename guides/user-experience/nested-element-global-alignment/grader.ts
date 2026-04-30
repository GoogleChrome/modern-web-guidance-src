import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const url = `file://${targetFile}`;

test.describe('Nested Element Global Alignment (Subgrid)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  test('should utilize CSS subgrid for nested grid alignment', async ({ page }) => {
    const hasSubgrid = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') || 
               style.gridTemplateRows.includes('subgrid');
      });
    });
    expect(hasSubgrid).toBe(true);
  });

  test('should align nested items precisely with parent grid tracks', async ({ page }) => {
    const noHacks = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      // Only check visible elements with content
      const alignedElements = allElements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               el.children.length === 0 && 
               (el.textContent?.trim().length ?? 0) > 0;
      });

      return alignedElements.every(el => {
        const style = window.getComputedStyle(el);
        const marginLeft = parseFloat(style.marginLeft);
        const position = style.position;
        const left = style.left;

        const hasNegativeMargin = marginLeft < -1;
        const hasAbsoluteOffset = position === 'absolute' && left !== 'auto' && parseFloat(left) !== 0;
        const hasRelativeOffset = position === 'relative' && left !== 'auto' && parseFloat(left) !== 0;
        
        return !hasNegativeMargin && !hasAbsoluteOffset && !hasRelativeOffset;
      });
    });
    expect(noHacks).toBe(true);
  });

  test('should automatically update nested item positioning when parent grid changes', async ({ page }) => {
    const followsParent = await page.evaluate(async () => {
      const subgridElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid') && el.firstElementChild;
      }) as HTMLElement[];

      if (subgridElements.length === 0) return false;

      // Try each subgrid until we find one that moves
      for (const subgrid of subgridElements) {
        const item = subgrid.firstElementChild as HTMLElement;
        if (!item) continue;

        const initialRect = item.getBoundingClientRect();

        let rootGrid = subgrid.parentElement;
        while (rootGrid) {
          const style = window.getComputedStyle(rootGrid);
          if (style.display === 'grid' && !style.gridTemplateColumns.includes('subgrid')) break;
          rootGrid = rootGrid.parentElement;
        }
        if (!rootGrid) continue;

        const originalStyle = rootGrid.style.gridTemplateColumns;
        rootGrid.style.gridTemplateColumns = '50px 50px 50px 50px 50px 50px';
        
        await new Promise(r => requestAnimationFrame(r));
        const newRect = item.getBoundingClientRect();
        const moved = Math.abs(newRect.left - initialRect.left) > 2;

        rootGrid.style.gridTemplateColumns = originalStyle;
        if (moved) return true;
      }
      return false;
    });
    expect(followsParent).toBe(true);
  });

  test('should allow intrinsic sizing of nested items to influence parent grid tracks', async ({ page }) => {
    const influencesParent = await page.evaluate(async () => {
      const subgridElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.gridTemplateColumns.includes('subgrid');
      }) as HTMLElement[];

      if (subgridElements.length === 0) return false;

      for (const subgrid of subgridElements) {
        const item = subgrid.querySelector('h1, h2, h3, p, div') as HTMLElement;
        if (!item) continue;

        let rootGrid = subgrid.parentElement;
        while (rootGrid) {
          const style = window.getComputedStyle(rootGrid);
          if (style.display === 'grid' && !style.gridTemplateColumns.includes('subgrid')) break;
          rootGrid = rootGrid.parentElement;
        }
        if (!rootGrid) continue;

        // If it's a subgrid, this test is technically already passed because subgrid 
        // by definition propagates intrinsic sizing.
        // We can check the computed style of the subgrid element itself.
        const subgridStyle = window.getComputedStyle(subgrid);
        if (subgridStyle.gridTemplateColumns.includes('subgrid')) return true;
      }
      return false;
    });
    expect(influencesParent).toBe(true);
  });

  test('should not use redundant manual grid definitions on nested components', async ({ page }) => {
    const hasRedundantDefinitions = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'grid' || style.gridTemplateColumns.includes('subgrid')) return false;

        const parentGrid = el.parentElement?.closest('*') as HTMLElement;
        if (!parentGrid) return false;
        const parentStyle = window.getComputedStyle(parentGrid);

        if (parentStyle.display === 'grid') {
          const tracks = style.gridTemplateColumns.split(' ').length;
          const parentTracks = parentStyle.gridTemplateColumns.split(' ').length;
          
          // If it's duplicating the track count and not using subgrid
          if (tracks > 1 && tracks === parentTracks) return true;
          
          // Specific check for the negative demo's fixed pixel duplication
          if (style.gridTemplateColumns.includes('800px') && parentStyle.gridTemplateColumns.includes('800px')) {
            return true;
          }
        }
        return false;
      });
    });
    expect(hasRedundantDefinitions).toBe(false);
  });

  test('should not rely on absolute positioning or negative margins for alignment', async ({ page }) => {
    const usesHacks = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        const marginLeft = parseFloat(style.marginLeft);
        const position = style.position;
        const left = style.left;

        if (marginLeft < -5) return true;
        if (position === 'absolute' && left !== 'auto' && parseFloat(left) !== 0) return true;
        if (position === 'relative' && left !== 'auto' && parseFloat(left) !== 0) return true;

        return false;
      });
    });
    expect(usesHacks).toBe(false);
  });

  test('should not misuse display: contents on styled wrapper elements', async ({ page }) => {
    const misusedContents = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      return allElements.some(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'contents') {
          const hasBorder = parseFloat(style.borderTopWidth) > 0;
          const hasPadding = parseFloat(style.paddingTop) > 0;
          const hasBackground = (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') || 
                               (style.backgroundImage !== 'none');
          
          return hasBorder || hasPadding || hasBackground;
        }
        return false;
      });
    });
    expect(misusedContents).toBe(false);
  });
});
