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
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize static parsers
const { document } = parseHTML(htmlStr);
const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
const root = postcss([nested(), shorthandExpand()]).processSync(styles).root;

// Tests
test.describe(`Adapt Scrollbar Expectations: ${demoName}`, () => {

  // 1. Root element defines color-scheme: light dark
  test('The :root element must define color-scheme: light dark', async () => {
    let hasColorScheme = false;
    root.walkRules(rule => {
      if (rule.selector === ':root') {
        rule.walkDecls('color-scheme', decl => {
          if (decl.value.includes('light') && decl.value.includes('dark')) hasColorScheme = true;
        });
      }
    });
    expect(hasColorScheme).toBe(true);
  });

  // 2. CSS variables are used for scrollbar colors
  test('CSS custom properties must be used for scrollbar colors', async () => {
    let hasScrollbarVars = false;
    root.walkDecls(decl => {
      if (decl.prop.startsWith('--') && decl.prop.includes('scrollbar')) hasScrollbarVars = true;
    });
    expect(hasScrollbarVars).toBe(true);
  });

  // 3. prefers-color-scheme: dark updates variables
  test('A prefers-color-scheme: dark media query must update the scrollbar variables', async () => {
    let updatesInMedia = false;
    root.walkAtRules('media', atRule => {
      if (atRule.params.includes('prefers-color-scheme') && atRule.params.includes('dark')) {
        atRule.walkDecls(decl => {
          if (decl.prop.startsWith('--')) updatesInMedia = true;
        });
      }
    });
    expect(updatesInMedia).toBe(true);
  });

  // 4. scrollbar-color property uses var()
  test('The scrollbar-color property must utilize the defined CSS variables', async () => {
    let usesVars = false;
    root.walkDecls('scrollbar-color', decl => {
      if (decl.value.includes('var(--')) usesVars = true;
    });
    expect(usesVars).toBe(true);
  });

  // 5. scrollbar-width is explicitly applied
  test('The scrollbar-width property must be explicitly applied for macOS support', async () => {
    let hasWidth = false;
    root.walkDecls('scrollbar-width', () => {
      hasWidth = true;
    });
    expect(hasWidth).toBe(true);
  });

  // 6. Legacy WebKit styling is isolated with @supports
  test('Legacy WebKit scrollbar styling must be isolated within an @supports block', async () => {
    let hasProtectedWebkit = false;
    root.walkAtRules('supports', atRule => {
      if (atRule.params.includes('not') && atRule.params.includes('scrollbar-color') && atRule.params.includes('auto')) {
        atRule.walkRules(rule => {
          selectorParser(selectors => {
            selectors.walkPseudos(pseudo => {
              if (pseudo.value.includes('-webkit-scrollbar')) hasProtectedWebkit = true;
            });
          }).processSync(rule.selector);
        });
      }
    });
    expect(hasProtectedWebkit).toBe(true);
  });

  // 7. WebKit fallback includes dimension properties
  test('The legacy WebKit fallback must include basic scrollbar dimensions', async () => {
    let hasDimensions = false;
    root.walkAtRules('supports', atRule => {
      if (atRule.params.includes('not') && atRule.params.includes('scrollbar-color') && atRule.params.includes('auto')) {
        atRule.walkRules(rule => {
          let isWebkit = false;
          selectorParser(selectors => {
            selectors.walkPseudos(pseudo => {
              if (pseudo.value === '::-webkit-scrollbar') isWebkit = true;
            });
          }).processSync(rule.selector);

          if (isWebkit) {
            rule.walkDecls(decl => {
              if (decl.prop === 'width' || decl.prop === 'height') hasDimensions = true;
            });
          }
        });
      }
    });
    expect(hasDimensions).toBe(true);
  });

  // Setup browser testing
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

  // 8. scrollbar-gutter: stable
  test('At least one scrollable element must have scrollbar-gutter: stable applied', async ({ page }) => {
    // MANDATORY: You MUST apply scrollbar-gutter: stable; to the scrollable container.
    const hasGutter = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const scrollers = elements.filter(el => {
        const style = getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
      });
      return scrollers.some(el => getComputedStyle(el).scrollbarGutter.includes('stable'));
    });
    expect(hasGutter).toBe(true);
  });

  // 9. Scrollable element exists and respects system preferences
  test('A scrollable element must exist and inherit the root light/dark color scheme', async ({ page }) => {
    // The agent has created a scrollable element... and utilizes the color-scheme property.
    const isAdaptive = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const scrollers = elements.filter(el => {
        const style = getComputedStyle(el);
        return style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
      });
      // Check if the first scroller found inherits the light dark color scheme
      return scrollers.length > 0 && getComputedStyle(scrollers[0]).colorScheme === 'light dark';
    });
    expect(isAdaptive).toBe(true);
  });
});
