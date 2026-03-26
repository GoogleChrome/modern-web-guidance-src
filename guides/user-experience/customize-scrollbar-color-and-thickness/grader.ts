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

test.describe(`Scrollbar Customization Expectations: ${demoName}`, () => {
  // Static assertions
  test('Standard scrollbar-width property is used in CSS', () => {
    let hasWidth = false;
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property === 'scrollbar-width') hasWidth = true;
      }
    });
    expect(hasWidth).toBe(true);
  });

  test('Standard scrollbar-color property is used in CSS', () => {
    let hasColor = false;
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property === 'scrollbar-color') hasColor = true;
      }
    });
    expect(hasColor).toBe(true);
  });

  test('scrollbar-gutter: stable is used in CSS', () => {
    let hasGutterStable = false;
    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (node.property === 'scrollbar-gutter') {
          const valueText = csstree.generate(node.value);
          if (valueText.includes('stable')) hasGutterStable = true;
        }
      }
    });
    expect(hasGutterStable).toBe(true);
  });

  test('Legacy ::-webkit-scrollbar is wrapped in @supports not (scrollbar-color: auto)', () => {
    let hasWebkits = false;
    let protectedWebkits = false;
    
    // First figure out if there's any webkit scrollbar at all
    csstree.walk(ast, {
      visit: 'PseudoElementSelector',
      enter(node) {
        if (node.name.includes('-webkit-scrollbar')) hasWebkits = true;
      }
    });

    if (hasWebkits) {
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
                    protectedWebkits = true;
                  }
                }
              });
            }
          }
        }
      });
      expect(protectedWebkits).toBe(true);
    } else {
      expect(hasWebkits).toBe(false); // Assume if checking for legacy webkit rules, they exist in fallback
    }
  });

  test('Legacy ::-webkit-scrollbar has width or height defined for visibility', () => {
    let hasSizingInFallback = false;
    
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        if (node.name === 'supports' && node.prelude?.type === 'AtrulePrelude') {
          const preludeText = csstree.generate(node.prelude);
          if (preludeText.includes('not') && preludeText.includes('scrollbar-color') && preludeText.includes('auto')) {
            csstree.walk(node.block!, {
              visit: 'Rule',
              enter(ruleNode) {
                const selectorText = csstree.generate(ruleNode.prelude);
                if (selectorText.includes('::-webkit-scrollbar')) {
                  csstree.walk(ruleNode.block, {
                    visit: 'Declaration',
                    enter(declNode) {
                      if (declNode.property === 'width' || declNode.property === 'height') {
                        hasSizingInFallback = true;
                      }
                    }
                  });
                }
              }
            });
          }
        }
      }
    });
    // This is tested strictly inside the at-supports block
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
