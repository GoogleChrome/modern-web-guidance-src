import { test, expect } from '@playwright/test';
import * as path from 'path';

// Helper to resolve and format target file URL
function getTargetUrl(): string {
  const target = process.env.TARGET_FILE;
  if (!target) {
    throw new Error('TARGET_FILE environment variable is not defined.');
  }
  // Ensure we have a valid absolute path file:// URL
  const absolutePath = path.isAbsolute(target) ? target : path.resolve(target);
  return `file://${absolutePath}`;
}

test.describe('Typography layout and legibility constraints', () => {
  test.beforeEach(async ({ page }) => {
    const targetUrl = getTargetUrl();
    await page.goto(targetUrl);
  });

  test('h1 element has a computed text-wrap value of balance', async ({ page }) => {
    const textWrap = await page.evaluate(() => {
      let el = document.querySelector('h1');
      let created = false;
      if (!el) {
        el = document.createElement('h1');
        document.body.appendChild(el);
        created = true;
      }
      const val = window.getComputedStyle(el).textWrap;
      if (created && el) {
        el.remove();
      }
      return val;
    });
    expect(textWrap).toBe('balance');
  });

  test('h2 element has a computed text-wrap value of balance', async ({ page }) => {
    const textWrap = await page.evaluate(() => {
      let el = document.querySelector('h2');
      let created = false;
      if (!el) {
        el = document.createElement('h2');
        document.body.appendChild(el);
        created = true;
      }
      const val = window.getComputedStyle(el).textWrap;
      if (created && el) {
        el.remove();
      }
      return val;
    });
    expect(textWrap).toBe('balance');
  });

  test('p element has a computed text-wrap value of pretty', async ({ page }) => {
    const textWrap = await page.evaluate(() => {
      let el = document.querySelector('p');
      let created = false;
      if (!el) {
        el = document.createElement('p');
        document.body.appendChild(el);
        created = true;
      }
      const val = window.getComputedStyle(el).textWrap;
      if (created && el) {
        el.remove();
      }
      return val;
    });
    expect(textWrap).toBe('pretty');
  });

  test('blockquote element has a computed text-wrap value of pretty', async ({ page }) => {
    const textWrap = await page.evaluate(() => {
      let el = document.querySelector('blockquote');
      let created = false;
      if (!el) {
        el = document.createElement('blockquote');
        document.body.appendChild(el);
        created = true;
      }
      const val = window.getComputedStyle(el).textWrap;
      if (created && el) {
        el.remove();
      }
      return val;
    });
    expect(textWrap).toBe('pretty');
  });

  test('p element does not have a computed text-wrap value of balance', async ({ page }) => {
    const textWrap = await page.evaluate(() => {
      let el = document.querySelector('p');
      let created = false;
      if (!el) {
        el = document.createElement('p');
        document.body.appendChild(el);
        created = true;
      }
      const val = window.getComputedStyle(el).textWrap;
      if (created && el) {
        el.remove();
      }
      return val;
    });
    expect(textWrap).not.toBe('balance');
  });

  test('text-wrap property is not applied to the * universal selector', async ({ page }) => {
    const textWrapOnUniversal = await page.evaluate(() => {
      let applied = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) {
            continue;
          }
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule) {
              const selectors = rule.selectorText.split(',').map(s => s.trim());
              if (selectors.includes('*') && (rule.style.textWrap || rule.style.getPropertyValue('text-wrap'))) {
                applied = true;
              }
            }
          }
        } catch (e: any) {
          // Explicitly check for SecurityError/cross-origin stylesheet restrictions
          if (e && (e.name === 'SecurityError' || e.message?.includes('cssRules') || e.message?.includes('SecurityError'))) {
            continue;
          }
          throw e; // Rethrow unexpected exceptions
        }
      }
      return applied;
    });
    expect(textWrapOnUniversal).toBe(false);
  });

  test('text-wrap property is not applied to the body element', async ({ page }) => {
    const textWrapOnBodyInStyleSheet = await page.evaluate(() => {
      let applied = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) {
            continue;
          }
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule) {
              const selectors = rule.selectorText.split(',').map(s => s.trim());
              if (selectors.includes('body') && (rule.style.textWrap || rule.style.getPropertyValue('text-wrap'))) {
                applied = true;
              }
            }
          }
        } catch (e: any) {
          // Explicitly check for SecurityError/cross-origin stylesheet restrictions
          if (e && (e.name === 'SecurityError' || e.message?.includes('cssRules') || e.message?.includes('SecurityError'))) {
            continue;
          }
          throw e; // Rethrow unexpected exceptions
        }
      }
      return applied;
    });
    expect(textWrapOnBodyInStyleSheet).toBe(false);
  });
});
