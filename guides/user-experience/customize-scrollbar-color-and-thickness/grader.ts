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

// Extract CSS and parse with PostCSS (including nesting and shorthand expansion)
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const root = postcss([nested(), shorthandExpand()]).processSync(styles).root;

test.describe(`Scrollbar Customization Expectations: ${demoName}`, () => {
  // Static assertions
  test('Standard scrollbar-width property is used in CSS', () => {
    let hasWidth = false;
    root.walkDecls('scrollbar-width', () => {
      hasWidth = true;
    });
    expect(hasWidth).toBe(true);
  });

  test('Standard scrollbar-color property is used in CSS', () => {
    let hasColor = false;
    root.walkDecls('scrollbar-color', () => {
      hasColor = true;
    });
    expect(hasColor).toBe(true);
  });

  test('scrollbar-gutter: stable is used in CSS', () => {
    let hasGutterStable = false;
    root.walkDecls('scrollbar-gutter', (decl) => {
      if (decl.value.includes('stable')) hasGutterStable = true;
    });
    expect(hasGutterStable).toBe(true);
  });

  test('Legacy ::-webkit-scrollbar is wrapped in @supports not (scrollbar-color: auto)', () => {
    let hasWebkits = false;
    let protectedWebkits = false;
    
    // First figure out if there's any webkit scrollbar at all
    root.walkRules(rule => {
      selectorParser(selectors => {
        selectors.walkPseudos(pseudo => {
          if (pseudo.value.includes('-webkit-scrollbar')) hasWebkits = true;
        });
      }).processSync(rule.selector);
    });

    if (hasWebkits) {
      root.walkAtRules('supports', atRule => {
        if (atRule.params.includes('not') && atRule.params.includes('scrollbar-color') && atRule.params.includes('auto')) {
          atRule.walkRules(rule => {
            selectorParser(selectors => {
              selectors.walkPseudos(pseudo => {
                if (pseudo.value.includes('-webkit-scrollbar')) protectedWebkits = true;
              });
            }).processSync(rule.selector);
          });
        }
      });
      expect(protectedWebkits).toBe(true);
    } else {
      expect(hasWebkits).toBe(false);
    }
  });

  test('Legacy ::-webkit-scrollbar has width or height defined for visibility', () => {
    let hasSizingInFallback = false;
    
    root.walkAtRules('supports', atRule => {
      if (atRule.params.includes('not') && atRule.params.includes('scrollbar-color') && atRule.params.includes('auto')) {
        atRule.walkRules(rule => {
          let isWebkitScrollbar = false;
          selectorParser(selectors => {
            selectors.walkPseudos(pseudo => {
              if (pseudo.value === '::-webkit-scrollbar') isWebkitScrollbar = true;
            });
          }).processSync(rule.selector);

          if (isWebkitScrollbar) {
            rule.walkDecls(decl => {
              if (decl.prop === 'width' || decl.prop === 'height') hasSizingInFallback = true;
            });
          }
        });
      }
    });
    expect(hasSizingInFallback).toBe(true);
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

  // Browser assertions
  test('Scrollable element has scrollbar-width applied', async ({ page }) => {
    const hasScrollbarWidth = await page.evaluate(() => {
      const elements = [document.documentElement, document.body, ...document.querySelectorAll('.custom-scrollbar, .scroll-box')];
      return elements.some(el => getComputedStyle(el).scrollbarWidth !== 'auto');
    });
    expect(hasScrollbarWidth).toBe(true);
  });

  test('Scrollable element has scrollbar-color applied', async ({ page }) => {
    const hasScrollbarColor = await page.evaluate(() => {
      const elements = [document.documentElement, document.body, ...document.querySelectorAll('.custom-scrollbar, .scroll-box')];
      return elements.some(el => getComputedStyle(el).scrollbarColor !== 'auto');
    });
    expect(hasScrollbarColor).toBe(true);
  });

  test('Scrollable element has scrollbar-gutter set to stable', async ({ page }) => {
    const hasScrollbarGutter = await page.evaluate(() => {
      const elements = [document.documentElement, document.body, ...document.querySelectorAll('.custom-scrollbar, .scroll-box')];
      return elements.some(el => getComputedStyle(el).scrollbarGutter === 'stable');
    });
    expect(hasScrollbarGutter).toBe(true);
  });
});
