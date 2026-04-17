import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import { Parser, CSSStyleRule, CSSMediaRule, CSSUnknownRule, serialize, ComponentValue } from '../../../lib/third_party/cssom/index.js';



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
const styleRules = Parser.parseStyleSheetText(styles);

// Tests
test.describe(`Adapt Scrollbar Expectations: ${demoName}`, () => {

  // 1. Root element defines color-scheme: light dark
  test('The :root element must define color-scheme: light dark', async () => {
    let hasColorScheme = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
        const value = rule.style.getPropertyValue('color-scheme');
        if (value.includes('light') && value.includes('dark')) hasColorScheme = true;
      }
    });
    expect(hasColorScheme).toBe(true);
  });

  // 2. CSS variables are used for scrollbar colors
  test('CSS custom properties must be used for scrollbar colors', async () => {
    let hasScrollbarVars = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style.item(i);
          if (prop.startsWith('--') && prop.includes('scrollbar')) hasScrollbarVars = true;
        }
      }
    });
    expect(hasScrollbarVars).toBe(true);
  });

  // 3. prefers-color-scheme: dark updates variables
  test('A prefers-color-scheme: dark media query must update the scrollbar variables', async () => {
    let updatesInMedia = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSMediaRule) {
        if (rule.media.mediaText.includes('prefers-color-scheme') && rule.media.mediaText.includes('dark')) {
          for (let i = 0; i < rule.cssRules.length; i++) {
            const childRule = rule.cssRules[i];
            if (childRule instanceof CSSStyleRule) {
              for (let j = 0; j < childRule.style.length; j++) {
                const prop = childRule.style.item(j);
                if (prop.startsWith('--')) updatesInMedia = true;
              }
            }
          }
        }
      }
    });
    expect(updatesInMedia).toBe(true);
  });

  // 4. scrollbar-color property uses var()
  test('The scrollbar-color property must utilize the defined CSS variables', async () => {
    let usesVars = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        const value = rule.style.getPropertyValue('scrollbar-color');
        if (value.includes('var(--')) usesVars = true;
      }
    });
    expect(usesVars).toBe(true);
  });

  // 5. scrollbar-width is explicitly applied
  test('The scrollbar-width property must be explicitly applied for macOS support', async () => {
    let hasWidth = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        if (rule.style.getPropertyValue('scrollbar-width')) hasWidth = true;
      }
    });
    expect(hasWidth).toBe(true);
  });

  // 6. Legacy WebKit styling is isolated with @supports
  test('Legacy WebKit scrollbar styling must be isolated within an @supports block', async () => {
    let hasProtectedWebkit = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSUnknownRule && rule.name === 'supports') {
        const preludeStr = serialize(rule.prelude as ComponentValue[]);
        if (preludeStr.includes('not') && preludeStr.includes('scrollbar-color') && preludeStr.includes('auto')) {
          const block = rule.block;
          if (block && typeof block === 'object' && 'value' in block && Array.isArray(block.value)) {
            const childRules = Parser.parseStyleSheetText(serialize(block.value));
            childRules.forEach(childRule => {
              if (childRule instanceof CSSStyleRule) {
                if (childRule.selectorText.includes('-webkit-scrollbar')) hasProtectedWebkit = true;
              }
            });
          }
        }
      }
    });
    expect(hasProtectedWebkit).toBe(true);
  });

  // 7. WebKit fallback includes dimension properties
  test('The legacy WebKit fallback must include basic scrollbar dimensions', async () => {
    let hasDimensions = false;
    styleRules.forEach(rule => {
      if (rule instanceof CSSUnknownRule && rule.name === 'supports') {
        const preludeStr = serialize(rule.prelude as ComponentValue[]);
        if (preludeStr.includes('not') && preludeStr.includes('scrollbar-color') && preludeStr.includes('auto')) {
          const block = rule.block;
          if (block && typeof block === 'object' && 'value' in block && Array.isArray(block.value)) {
            const childRules = Parser.parseStyleSheetText(serialize(block.value));
            childRules.forEach(childRule => {
              if (childRule instanceof CSSStyleRule) {
                if (childRule.selectorText.includes('::-webkit-scrollbar')) {
                  if (childRule.style.getPropertyValue('width') || childRule.style.getPropertyValue('height')) {
                    hasDimensions = true;
                  }
                }
              }
            });
          }
        }
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
