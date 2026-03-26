import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import * as csstree from 'css-tree';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) throw new Error('TARGET_FILE environment variable not set.');

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

// Extract CSS
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const ast = csstree.parse(styles);

// Tests
test.describe(`Adapt scrollbar to high-contrast preferences Expectations: ${demoName}`, () => {
  
  test('CSS variables are defined for scrollbar thumb and track colors', () => {
    let hasThumbVar = false;
    let hasTrackVar = false;
    
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property.includes('--') && node.property.includes('thumb')) hasThumbVar = true;
        if (node.property.includes('--') && node.property.includes('track')) hasTrackVar = true;
      }
    });
    
    expect(hasThumbVar && hasTrackVar).toBe(true);
  });

  test('@media (prefers-contrast: more) block updates scrollbar CSS variables', () => {
    let foundUpdate = false;
    
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.name === 'media' && node.prelude?.type === 'AtrulePrelude') {
          const preludeText = csstree.generate(node.prelude);
          if (preludeText.includes('prefers-contrast') && preludeText.includes('more')) {
            // Check if it updates custom properties inside
            csstree.walk(node.block!, {
              visit: 'Declaration',
              enter(decl) {
                if (decl.property.includes('--') && (decl.property.includes('thumb') || decl.property.includes('track'))) {
                  foundUpdate = true;
                }
              }
            });
          }
        }
      }
    });

    expect(foundUpdate).toBe(true);
  });

  test('scrollbar-color property uses CSS variables', () => {
    let usesVars = false;
    
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property === 'scrollbar-color') {
          const valueText = csstree.generate(node.value);
          if (valueText.includes('var(--') && valueText.includes('var(--')) {
            usesVars = true; // Two var() calls expected
          }
        }
      }
    });

    expect(usesVars).toBe(true);
  });

  test('Legacy scrollbar pseudo-elements are isolated within @supports not (scrollbar-color: auto)', () => {
    let hasWebkitScrollbar = false;
    let hasProtectedWebkitScrollbar = false;
    
    // First figure out if there's any webkit scrollbar at all
    csstree.walk(ast, {
      visit: 'PseudoElementSelector',
      enter(node) {
        if (node.name.includes('-webkit-scrollbar')) {
          hasWebkitScrollbar = true;
        }
      }
    });

    if (hasWebkitScrollbar) {
      csstree.walk(ast, {
        visit: 'Atrule',
        enter(node) {
          if (node.name === 'supports' && node.prelude?.type === 'AtrulePrelude') {
            const preludeText = csstree.generate(node.prelude);
            if (preludeText.includes('not') && preludeText.includes('scrollbar-color') && preludeText.includes('auto')) {
              // Found the protected block, see if webkit scrollbar is inside
              csstree.walk(node.block!, {
                visit: 'PseudoElementSelector',
                enter(pseudoNode) {
                  if (pseudoNode.name.includes('-webkit-scrollbar')) {
                    hasProtectedWebkitScrollbar = true;
                  }
                }
              });
            }
          }
        }
      });
      expect(hasProtectedWebkitScrollbar).toBe(true);
    } else {
      expect(hasWebkitScrollbar).toBe(false);
    }
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
      if (fs.existsSync(localFilePath)) await route.fulfill({ path: localFilePath });
      else await route.continue();
    });
    await page.goto(demoUrl);
  });

  // Browser test: Verify variables change under prefers-contrast: more
  test('CSS variables for scrollbar update to high-contrast colors when prefers-contrast: more is emulated', async ({ page }) => {
    const scroller = page.locator('.scroller, .adaptive-contrast, .content-box, [style*="scrollbar-color"], [style*="overflow"]').first();
    const initialThumb = await scroller.evaluate(el => getComputedStyle(el).getPropertyValue('--scrollbar-thumb').trim() || getComputedStyle(el).getPropertyValue('--thumb').trim());
    await page.emulateMedia({ contrast: 'more' });
    const highContrastThumb = await scroller.evaluate(el => getComputedStyle(el).getPropertyValue('--scrollbar-thumb').trim() || getComputedStyle(el).getPropertyValue('--thumb').trim());
    expect(highContrastThumb.toLowerCase()).not.toBe(initialThumb.toLowerCase());
  });

  // Browser test: High contrast colors are actually distinct
  test('High contrast scrollbar colors are highly distinct (e.g., black or white)', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    const scroller = page.locator('.scroller, .adaptive-contrast, .content-box, [style*="scrollbar-color"], [style*="overflow"]').first();
    const thumbColor = await scroller.evaluate(el => getComputedStyle(el).getPropertyValue('--scrollbar-thumb').trim());
    const trackColor = await scroller.evaluate(el => getComputedStyle(el).getPropertyValue('--scrollbar-track').trim());
    
    // Check if thumb is black or very dark
    const isHighContrast = (thumbColor.toLowerCase() === '#000000' || thumbColor.toLowerCase() === '#000' || thumbColor.toLowerCase() === 'black') ||
                           (trackColor.toLowerCase() === '#ffffff' || trackColor.toLowerCase() === '#fff' || trackColor.toLowerCase() === 'white');
    
    expect(isHighContrast).toBe(true);
  });
});
