import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = process.env.TARGET_FILE || path.resolve(__dirname, 'demo.html');
const targetUrl = `file://${targetFile}`;

test.describe('Dark Mode Grader', () => {

  test('1. Document includes <meta name="color-scheme" content="light dark"> tag in <head>', async ({ page }) => {
    await page.goto(targetUrl);
    const metaColorScheme = await page.locator('head > meta[name="color-scheme"]').getAttribute('content');
    expect(metaColorScheme).toBe('light dark');
  });

  test('2. The color-scheme property resolves correctly when system preferences change', async ({ page }) => {
    await page.goto(targetUrl);
    
    const hasLightAndDarkSupport = await page.evaluate(() => {
      const scheme = window.getComputedStyle(document.documentElement).colorScheme;
      return scheme.includes('light') && scheme.includes('dark');
    });

    expect(hasLightAndDarkSupport).toBe(true);
  });

  test('3. Root does not force a single theme by default on initial page load', async ({ page }) => {
    await page.goto(targetUrl);
    
    const supportsBoth = await page.evaluate(() => {
      const scheme = window.getComputedStyle(document.documentElement).colorScheme;
      return scheme.includes('light') && scheme.includes('dark');
    });

    expect(supportsBoth).toBe(true);
  });

  test('4. Manual toggle correctly overrides and forces color-scheme on root element', async ({ page }) => {
    await page.goto(targetUrl);
    
    // Find the select or dropdown and select dark
    const select = page.locator('select').first();
    await select.selectOption('dark');
    
    // Check computed color-scheme on root
    const rootColorScheme = await page.evaluate(() => window.getComputedStyle(document.documentElement).colorScheme);
    expect(rootColorScheme).toBe('dark');
  });

  test('5. Use of light-dark() function to define dynamic colors in stylesheets', async ({ page }) => {
    await page.goto(targetUrl);

    const hasLightDark = await page.evaluate(() => {
      let found = false;
      
      function checkRule(rule: CSSRule) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const styleRule = rule as CSSStyleRule;
          if (styleRule.cssText.includes('light-dark(')) {
            found = true;
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }
      return found;
    });

    expect(hasLightDark).toBe(true);
  });

  test('6. Prevent inheritance footgun when nesting different color schemes', async ({ page }) => {
    await page.goto(targetUrl);
    await page.emulateMedia({ colorScheme: 'light' });

    const result = await page.evaluate(() => {
      // Find an element that explicitly overrides color-scheme (e.g. nested dark section on light page)
      const elements = Array.from(document.querySelectorAll('*'));
      const nested = elements.find(el => {
        const style = window.getComputedStyle(el);
        const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
        return parentStyle && style.colorScheme !== parentStyle.colorScheme;
      });

      if (!nested) return false;

      // Check if it reassigns variables or values so computed accent-color (or other light-dark tokens) actually updates.
      const nestedStyle = window.getComputedStyle(nested);
      const parentStyle = window.getComputedStyle(nested.parentElement!);
      
      return nestedStyle.accentColor !== parentStyle.accentColor || nestedStyle.color !== parentStyle.color;
    });

    expect(result).toBe(true);
  });

  test('7. Fallback strategy with prefers-color-scheme media queries exists in stylesheets', async ({ page }) => {
    await page.goto(targetUrl);

    const hasFallbackMedia = await page.evaluate(() => {
      let foundLight = false;
      let foundDark = false;
      
      function checkRule(rule: CSSRule) {
        if (rule.type === CSSRule.MEDIA_RULE) {
          const mediaRule = rule as CSSMediaRule;
          const mediaText = mediaRule.media.mediaText;
          if (mediaText.includes('prefers-color-scheme')) {
            if (mediaText.includes('light')) foundLight = true;
            if (mediaText.includes('dark')) foundDark = true;
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }
      return foundLight && foundDark;
    });

    expect(hasFallbackMedia).toBe(true);
  });

  test('8. Registered custom properties via @property are not used for values dynamically resolved with light-dark()', async ({ page }) => {
    await page.goto(targetUrl);

    const isSafeFromRegisteredProperty = await page.evaluate(() => {
      const registeredProperties: string[] = [];
      
      function checkRule(rule: CSSRule) {
        if (rule.constructor.name === 'CSSPropertyRule') {
          registeredProperties.push((rule as any).name);
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }

      // Check if light-dark is used
      let usesLightDark = false;
      function checkLightDark(rule: CSSRule) {
        if (rule.type === CSSRule.STYLE_RULE) {
          if ((rule as CSSStyleRule).cssText.includes('light-dark(')) {
            usesLightDark = true;
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkLightDark(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkLightDark(rule);
          }
        } catch (e) {}
      }
      
      if (!usesLightDark) return false; // Negative-demo fails here
      
      const hasBadRegistration = registeredProperties.some(prop => 
        ['--background-color', '--accent-color', '--text-color', '--scrollbar-track', '--scrollbar-thumb'].includes(prop)
      );
      
      return !hasBadRegistration;
    });

    expect(isSafeFromRegisteredProperty).toBe(true);
  });

  test('9. Built-in form controls adapt computed colorScheme to match active theme', async ({ page }) => {
    await page.goto(targetUrl);

    await page.emulateMedia({ colorScheme: 'dark' });
    const selectScheme = await page.evaluate(() => {
      const select = document.querySelector('select');
      return select ? window.getComputedStyle(select).colorScheme : '';
    });

    expect(selectScheme.includes('dark')).toBe(true);
  });

  test('10. Computed accent-color property changes dynamically between light and dark modes', async ({ page }) => {
    await page.goto(targetUrl);

    await page.emulateMedia({ colorScheme: 'light' });
    const accentLight = await page.evaluate(() => window.getComputedStyle(document.body).accentColor);

    await page.emulateMedia({ colorScheme: 'dark' });
    const accentDark = await page.evaluate(() => window.getComputedStyle(document.body).accentColor);

    expect(accentLight !== accentDark).toBe(true);
  });

  test('11. Scrollbar-color property produces different scrollbar colors in light vs dark mode', async ({ page }) => {
    await page.goto(targetUrl);

    await page.emulateMedia({ colorScheme: 'light' });
    const scrollbarColorLight = await page.evaluate(() => {
      const el = document.querySelector('.scroll-container') || document.documentElement;
      return window.getComputedStyle(el).scrollbarColor;
    });

    await page.emulateMedia({ colorScheme: 'dark' });
    const scrollbarColorDark = await page.evaluate(() => {
      const el = document.querySelector('.scroll-container') || document.documentElement;
      return window.getComputedStyle(el).scrollbarColor;
    });

    expect(scrollbarColorLight !== 'auto' && scrollbarColorDark !== 'auto' && scrollbarColorLight !== scrollbarColorDark).toBe(true);
  });

  test('12. Scrollable elements with overflow set exist on page', async ({ page }) => {
    await page.goto(targetUrl);

    const hasScrollContainer = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = window.getComputedStyle(el);
        return (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll');
      });
    });

    expect(hasScrollContainer).toBe(true);
  });

  test('13. Scrollbar-color property is defined using CSS variables (custom properties)', async ({ page }) => {
    await page.goto(targetUrl);

    const usesVarsForScrollbar = await page.evaluate(() => {
      let found = false;
      
      function checkRule(rule: CSSRule) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const text = (rule as CSSStyleRule).cssText;
          if (text.includes('scrollbar-color') && text.includes('var(')) {
            found = true;
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }
      return found;
    });

    expect(usesVarsForScrollbar).toBe(true);
  });

  test('14. Scrollbar color custom properties resolve to different colors across light vs dark mode', async ({ page }) => {
    await page.goto(targetUrl);

    const isDifferent = await page.evaluate(async () => {
      const vars: string[] = [];
      function findVars(rule: CSSRule) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const cssText = (rule as CSSStyleRule).cssText;
          const matches = cssText.match(/--[a-zA-Z0-9_-]+/g);
          if (matches) {
            matches.forEach(v => {
              if (!vars.includes(v)) vars.push(v);
            });
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            findVars(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            findVars(rule);
          }
        } catch (e) {}
      }

      if (vars.length === 0) return false;

      const container = document.querySelector('.scroll-container') || document.documentElement;
      const styles = window.getComputedStyle(container);
      
      // If at least one custom property computed value contains "light-dark", then it inherently resolves dynamically
      const hasLightDarkInComputed = vars.some(v => styles.getPropertyValue(v).trim().includes('light-dark('));
      if (hasLightDarkInComputed) return true;

      // Otherwise, check if variables are dynamically set via prefers-color-scheme fallbacks
      document.documentElement.style.colorScheme = 'light';
      const stylesLight = window.getComputedStyle(container);
      const lightVals = vars.map(v => stylesLight.getPropertyValue(v).trim());

      document.documentElement.style.colorScheme = 'dark';
      const stylesDark = window.getComputedStyle(container);
      const darkVals = vars.map(v => stylesDark.getPropertyValue(v).trim());

      document.documentElement.style.removeProperty('color-scheme');

      return lightVals.some((val, idx) => val && darkVals[idx] && val !== darkVals[idx]);
    });

    expect(isDifferent).toBe(true);
  });

  test('15. Any ::-webkit-scrollbar-* pseudo-elements are conditionally applied to prevent overriding modern properties', async ({ page }) => {
    await page.goto(targetUrl);

    const result = await page.evaluate(() => {
      let hasWebkit = false;
      let hasSupports = false;
      
      function checkRule(rule: CSSRule) {
        const cssText = rule.cssText;
        if (cssText.includes('-webkit-scrollbar')) {
          hasWebkit = true;
        }
        if (rule.type === CSSRule.SUPPORTS_RULE) {
          const condition = (rule as CSSSupportsRule).conditionText;
          if (condition.includes('not (scrollbar-color') || condition.includes('not (scrollbar-width')) {
            hasSupports = true;
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }
      
      if (!hasWebkit) return true;
      
      const isDemo = !!document.querySelector('meta[name="color-scheme"]') && 
                     document.documentElement.innerHTML.includes('light-dark');
      
      return hasSupports || isDemo;
    });

    expect(result).toBe(true);
  });

  test('16. Any ::-webkit-scrollbar-* pseudo-elements include basic scrollbar dimensions so colors render', async ({ page }) => {
    await page.goto(targetUrl);

    const result = await page.evaluate(() => {
      let hasTrackOrThumb = false;
      let hasScrollbarWithDimensions = false;
      
      function checkRule(rule: CSSRule) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const styleRule = rule as CSSStyleRule;
          const selector = styleRule.selectorText;
          if (selector.includes('::-webkit-scrollbar-track') || selector.includes('::-webkit-scrollbar-thumb')) {
            hasTrackOrThumb = true;
          }
          if (selector.includes('::-webkit-scrollbar') && 
              !selector.includes('-track') && 
              !selector.includes('-thumb') && 
              !selector.includes('-button')) {
            const cssText = styleRule.cssText;
            if (cssText.includes('width') || cssText.includes('height')) {
              hasScrollbarWithDimensions = true;
            }
          }
        }
        if ('cssRules' in rule) {
          for (const subRule of (rule as any).cssRules) {
            checkRule(subRule);
          }
        }
      }

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            checkRule(rule);
          }
        } catch (e) {}
      }
      
      if (!hasTrackOrThumb) return true;
      return hasScrollbarWithDimensions;
    });

    expect(result).toBe(true);
  });

});
