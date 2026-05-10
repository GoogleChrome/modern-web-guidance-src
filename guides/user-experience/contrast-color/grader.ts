import { test, expect } from '@playwright/test';

test.describe('Contrast Color Grading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`file://${process.env.TARGET_FILE}`);
  });

  test('the text color property MUST be set using the contrast-color() function', async ({ page }) => {
    const hasContrastColorInColor = await page.evaluate(() => {
      const walkRules = (rules: CSSRuleList): boolean => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            if (rule.style.color && rule.style.color.includes('contrast-color')) return true;
          } else if (rule instanceof CSSSupportsRule) {
            if (walkRules(rule.cssRules)) return true;
          }
        }
        return false;
      };
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return walkRules(sheet.cssRules);
        } catch (e) {
          return false;
        }
      });
    });
    expect(hasContrastColorInColor).toBe(true);
  });

  test('the argument to contrast-color() SHOULD reference the background color or its custom property', async ({ page }) => {
    const validArgument = await page.evaluate(() => {
      let found = false;
      let matchesBackground = false;

      const selectorsWithContrastArg = new Map<string, string>();
      const selectorsWithBg = new Map<string, string>();

      const walkRules = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            const colorValue = rule.style.color;
            if (colorValue && colorValue.includes('contrast-color')) {
              found = true;
              const match = colorValue.match(/contrast-color\(([^)]+)\)/);
              if (match) {
                selectorsWithContrastArg.set(rule.selectorText, match[1].trim());
              }
            }
            if (rule.style.backgroundColor) {
              selectorsWithBg.set(rule.selectorText, rule.style.backgroundColor.trim());
            }
          } else if (rule instanceof CSSSupportsRule) {
            walkRules(rule.cssRules);
          }
        }
      };

      for (const sheet of document.styleSheets) {
        try { walkRules(sheet.cssRules); } catch (e) {}
      }

      for (const [selector, arg] of selectorsWithContrastArg.entries()) {
        const bg = selectorsWithBg.get(selector);
        if (bg && (bg.includes(arg) || arg.includes(bg))) {
          matchesBackground = true;
          break;
        }
      }
      
      return found && matchesBackground;
    });
    expect(validArgument).toBe(true);
  });

  test('a fallback strategy MUST be provided via static declaration or @supports block', async ({ page }) => {
    const hasFallback = await page.evaluate(() => {
      let hasSupports = false;
      const selectorsWithContrastColor = new Set<string>();
      const selectorsWithStaticColor = new Set<string>();

      const walkRules = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSSupportsRule) {
            if (rule.conditionText.includes('contrast-color')) {
              hasSupports = true;
            }
            walkRules(rule.cssRules);
          } else if (rule instanceof CSSStyleRule) {
            if (rule.style.color) {
              if (rule.style.color.includes('contrast-color')) {
                selectorsWithContrastColor.add(rule.selectorText);
              } else {
                selectorsWithStaticColor.add(rule.selectorText);
              }
            }
          }
        }
      };

      for (const sheet of document.styleSheets) {
        try { walkRules(sheet.cssRules); } catch (e) {}
      }
      
      const hasStaticFallback = Array.from(selectorsWithContrastColor).some(sel => selectorsWithStaticColor.has(sel));
      return hasSupports || hasStaticFallback; 
    });
    expect(hasFallback).toBe(true);
  });

  test('contrast-color() MUST NOT be used for background-color', async ({ page }) => {
    const usedForBg = await page.evaluate(() => {
      const walkRules = (rules: CSSRuleList): boolean => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            if (rule.style.backgroundColor && rule.style.backgroundColor.includes('contrast-color')) return true;
          } else if (rule instanceof CSSSupportsRule) {
            if (walkRules(rule.cssRules)) return true;
          }
        }
        return false;
      };
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return walkRules(sheet.cssRules);
        } catch (e) {
          return false;
        }
      });
    });
    expect(usedForBg).toBe(false);
  });
});
