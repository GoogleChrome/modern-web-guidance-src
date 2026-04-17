import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import { Parser, CSSStyleRule, CSSMediaRule, CSSUnknownRule, serialize } from '../../../lib/third_party/cssom/index.js';
import type { ComponentValue } from '../../../lib/third_party/cssom/index.js';




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

// Extract CSS and parse with CSSOM
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const styleRules = Parser.parseStyleSheetText(styles);

// Tests
test.describe(`Adapt scrollbar to high-contrast preferences Expectations: ${demoName}`, () => {
  
  test('CSS variables are defined for scrollbar thumb and track colors', () => {
    let hasThumbVar = false;
    let hasTrackVar = false;
    
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style.item(i);
          if (prop.includes('--') && prop.includes('thumb')) hasThumbVar = true;
          if (prop.includes('--') && prop.includes('track')) hasTrackVar = true;
        }
      }
    });
    
    expect(hasThumbVar && hasTrackVar).toBe(true);
  });

  test('@media (prefers-contrast: more) block updates scrollbar CSS variables', () => {
    let foundUpdate = false;
    
    styleRules.forEach(rule => {
      if (rule instanceof CSSMediaRule) {
        if (rule.media.mediaText.includes('prefers-contrast') && rule.media.mediaText.includes('more')) {
          for (let i = 0; i < rule.cssRules.length; i++) {
            const childRule = rule.cssRules[i];
            if (childRule instanceof CSSStyleRule) {
              for (let j = 0; j < childRule.style.length; j++) {
                const prop = childRule.style.item(j);
                if (prop.includes('--') && (prop.includes('thumb') || prop.includes('track'))) {
                  foundUpdate = true;
                }
              }
            }
          }
        }
      }
    });

    expect(foundUpdate).toBe(true);
  });

  test('scrollbar-color property uses CSS variables', () => {
    let usesVars = false;
    
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        const value = rule.style.getPropertyValue('scrollbar-color');
        if (value.includes('var(--') && value.includes('var(--')) {
          usesVars = true; // Two var() calls expected
        }
      }
    });

    expect(usesVars).toBe(true);
  });

  test('Legacy scrollbar pseudo-elements are isolated within @supports not (scrollbar-color: auto)', () => {
    let hasWebkitScrollbar = false;
    let hasProtectedWebkitScrollbar = false;
    
    // First figure out if there's any webkit scrollbar at all
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        if (rule.selectorText.includes('-webkit-scrollbar')) hasWebkitScrollbar = true;
      }
    });

    if (hasWebkitScrollbar) {
      styleRules.forEach(rule => {
        if (rule instanceof CSSUnknownRule && rule.name === 'supports') {
          const preludeStr = serialize(rule.prelude as ComponentValue[]);
          if (preludeStr.includes('not') && preludeStr.includes('scrollbar-color') && preludeStr.includes('auto')) {

            const block = rule.block;
            if (block && typeof block === 'object' && 'value' in block && Array.isArray(block.value)) {
              const childRules = Parser.parseStyleSheetText(serialize(block.value));
              childRules.forEach(childRule => {
                if (childRule instanceof CSSStyleRule) {
                  if (childRule.selectorText.includes('-webkit-scrollbar')) hasProtectedWebkitScrollbar = true;
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
