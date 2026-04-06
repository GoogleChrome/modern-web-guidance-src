import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import nested from 'postcss-nested';
import shorthandExpand from 'postcss-shorthand-expand';

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

// Extract CSS and parse with PostCSS
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const root = postcss([nested(), shorthandExpand()]).processSync(styles).root;

// Tests
test.describe(`Adapt scrollbar to high-contrast preferences Expectations: ${demoName}`, () => {
  
  test('CSS variables are defined for scrollbar thumb and track colors', () => {
    let hasThumbVar = false;
    let hasTrackVar = false;
    
    root.walkDecls(decl => {
      if (decl.prop.includes('--') && decl.prop.includes('thumb')) hasThumbVar = true;
      if (decl.prop.includes('--') && decl.prop.includes('track')) hasTrackVar = true;
    });
    
    expect(hasThumbVar && hasTrackVar).toBe(true);
  });

  test('@media (prefers-contrast: more) block updates scrollbar CSS variables', () => {
    let foundUpdate = false;
    
    root.walkAtRules('media', atRule => {
      if (atRule.params.includes('prefers-contrast') && atRule.params.includes('more')) {
        atRule.walkDecls(decl => {
          if (decl.prop.includes('--') && (decl.prop.includes('thumb') || decl.prop.includes('track'))) {
            foundUpdate = true;
          }
        });
      }
    });

    expect(foundUpdate).toBe(true);
  });

  test('scrollbar-color property uses CSS variables', () => {
    let usesVars = false;
    
    root.walkDecls('scrollbar-color', decl => {
      if (decl.value.includes('var(--') && decl.value.includes('var(--')) {
        usesVars = true; // Two var() calls expected
      }
    });

    expect(usesVars).toBe(true);
  });

  test('Legacy scrollbar pseudo-elements are isolated within @supports not (scrollbar-color: auto)', () => {
    let hasWebkitScrollbar = false;
    let hasProtectedWebkitScrollbar = false;
    
    // First figure out if there's any webkit scrollbar at all
    root.walkRules(rule => {
      selectorParser(selectors => {
        selectors.walkPseudos(pseudo => {
          if (pseudo.value.includes('-webkit-scrollbar')) hasWebkitScrollbar = true;
        });
      }).processSync(rule.selector);
    });

    if (hasWebkitScrollbar) {
      root.walkAtRules('supports', atRule => {
        if (atRule.params.includes('not') && atRule.params.includes('scrollbar-color') && atRule.params.includes('auto')) {
          atRule.walkRules(rule => {
            selectorParser(selectors => {
              selectors.walkPseudos(pseudo => {
                if (pseudo.value.includes('-webkit-scrollbar')) hasProtectedWebkitScrollbar = true;
              });
            }).processSync(rule.selector);
          });
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
