import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve(import.meta.dirname, 'demo.html');
const fileUrl = `file://${path.resolve(targetFile)}`;

test.beforeEach(async ({ page }) => {
  await page.goto(fileUrl);
  await page.waitForLoadState('domcontentloaded');
});

test('The component wrapper has container-type: inline-size (or size) applied', async ({ page }) => {
  const containerType = await page.evaluate(() => {
    const wrapper = document.querySelector('.card-wrapper');
    if (!wrapper) return null;
    const style = window.getComputedStyle(wrapper);
    return style.containerType || style.getPropertyValue('container-type');
  });

  expect(['inline-size', 'size']).toContain(containerType);
});

test('The component title has a font-size that uses container query units (like cqi or cqw)', async ({ page }) => {
  const hasContainerUnit = await page.evaluate(() => {
    let found = false;

    // Helper to check CSS rules
    const checkRule = (rule: CSSRule) => {
      if (rule instanceof CSSStyleRule) {
        const selector = rule.selectorText || '';
        if (selector.includes('card-title') || selector.includes('title')) {
          const fontSize = rule.style.fontSize;
          if (fontSize && (fontSize.includes('cqi') || fontSize.includes('cqw') || fontSize.includes('cqmin') || fontSize.includes('cqmax'))) {
            found = true;
          }
        }
      } else if (rule instanceof CSSSupportsRule) {
        for (let i = 0; i < rule.cssRules.length; i++) {
          checkRule(rule.cssRules[i]);
        }
      }
    };

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          checkRule(rules[j]);
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }

    // Check inline style
    const title = document.querySelector('.card-title');
    if (title) {
      const inlineStyle = title.getAttribute('style') || '';
      if (inlineStyle.includes('cqi') || inlineStyle.includes('cqw') || inlineStyle.includes('cqmin') || inlineStyle.includes('cqmax')) {
        found = true;
      }
    }

    return found;
  });

  expect(hasContainerUnit).toBe(true);
});

test('The component title uses clamp() to constrain the font size', async ({ page }) => {
  const hasClamp = await page.evaluate(() => {
    let found = false;

    const checkRule = (rule: CSSRule) => {
      if (rule instanceof CSSStyleRule) {
        const selector = rule.selectorText || '';
        if (selector.includes('card-title') || selector.includes('title')) {
          const fontSize = rule.style.fontSize;
          if (fontSize && fontSize.includes('clamp(')) {
            found = true;
          }
        }
      } else if (rule instanceof CSSSupportsRule) {
        for (let i = 0; i < rule.cssRules.length; i++) {
          checkRule(rule.cssRules[i]);
        }
      }
    };

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          checkRule(rules[j]);
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
    }

    // Check inline style
    const title = document.querySelector('.card-title');
    if (title) {
      const inlineStyle = title.getAttribute('style') || '';
      if (inlineStyle.includes('clamp(')) {
        found = true;
      }
    }

    return found;
  });

  expect(hasClamp).toBe(true);
});

test('The maximum size in clamp() for font size is at most 2.5 times the minimum size', async ({ page }) => {
  const clampRatio = await page.evaluate(() => {
    const extractClampValue = (styleStr: string | null): number | null => {
      if (!styleStr || !styleStr.includes('clamp(')) return null;
      
      const startIdx = styleStr.indexOf('clamp(');
      let openParens = 0;
      let currentArg = '';
      const args: string[] = [];
      
      for (let i = startIdx + 6; i < styleStr.length; i++) {
        const char = styleStr[i];
        if (char === '(') {
          openParens++;
          currentArg += char;
        } else if (char === ')') {
          if (openParens === 0) {
            args.push(currentArg.trim());
            break;
          } else {
            openParens--;
            currentArg += char;
          }
        } else if (char === ',' && openParens === 0) {
          args.push(currentArg.trim());
          currentArg = '';
        } else {
          currentArg += char;
        }
      }
      
      if (args.length === 3) {
        const minStr = args[0];
        const maxStr = args[2];
        
        const parseVal = (str: string): number => {
          const val = parseFloat(str);
          const unit = str.replace(/[\d.-]/g, '').trim().toLowerCase();
          let px = val;
          if (unit === 'rem' || unit === 'em') {
            px = val * 16;
          }
          return px;
        };
        
        const minPx = parseVal(minStr);
        const maxPx = parseVal(maxStr);
        if (!isNaN(minPx) && !isNaN(maxPx) && minPx > 0) {
          return maxPx / minPx;
        }
      }
      return null;
    };

    let resultRatio: number | null = null;

    const checkRule = (rule: CSSRule) => {
      if (rule instanceof CSSStyleRule) {
        const selector = rule.selectorText || '';
        if (selector.includes('card-title') || selector.includes('title')) {
          const ratio = extractClampValue(rule.style.fontSize);
          if (ratio !== null) resultRatio = ratio;
        }
      } else if (rule instanceof CSSSupportsRule) {
        for (let i = 0; i < rule.cssRules.length; i++) {
          checkRule(rule.cssRules[i]);
        }
      }
    };

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          checkRule(rules[j]);
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
    }

    const title = document.querySelector('.card-title') as HTMLElement;
    if (title && resultRatio === null) {
      const inlineStyle = title.style.fontSize;
      const ratio = extractClampValue(inlineStyle);
      if (ratio !== null) resultRatio = ratio;
    }

    return resultRatio;
  });

  expect(clampRatio).not.toBeNull();
  expect(clampRatio).toBeLessThanOrEqual(2.51);
});

test('The font size of the title changes when the width of the container changes, independently of the viewport size', async ({ page }) => {
  const fontSizeChanged = await page.evaluate(async () => {
    const wrapper = document.querySelector('.card-wrapper') as HTMLElement;
    const title = document.querySelector('.card-title') as HTMLElement;
    if (!wrapper || !title) return false;

    // Set container to inline-size type if it's not set (to isolate change)
    const originalWidth = wrapper.style.width;
    
    // Set initial size
    wrapper.style.width = '300px';
    // Flush style changes
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const sizeAt300 = parseFloat(window.getComputedStyle(title).fontSize);

    // Set larger size
    wrapper.style.width = '600px';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const sizeAt600 = parseFloat(window.getComputedStyle(title).fontSize);

    // Restore original width
    wrapper.style.width = originalWidth;

    return Math.abs(sizeAt600 - sizeAt300) > 0.5;
  });

  expect(fontSizeChanged).toBe(true);
});

test('A fallback font size using viewport units (like vw) or media queries is provided for browsers that do not support container query units', async ({ page }) => {
  const hasFallback = await page.evaluate(() => {
    let hasViewportUnit = false;
    let hasMediaQuery = false;
    let hasContainerUnit = false;

    const checkRule = (rule: CSSRule) => {
      if (rule instanceof CSSStyleRule) {
        const selector = rule.selectorText || '';
        if (selector.includes('card-title') || selector.includes('title')) {
          const fontSize = rule.style.fontSize;
          if (fontSize) {
            if (fontSize.includes('vw') || fontSize.includes('vh') || fontSize.includes('vmin') || fontSize.includes('vmax')) {
              hasViewportUnit = true;
            }
            if (fontSize.includes('cqi') || fontSize.includes('cqw') || fontSize.includes('cqmin') || fontSize.includes('cqmax')) {
              hasContainerUnit = true;
            }
          }
        }
      } else if (rule instanceof CSSSupportsRule) {
        for (let i = 0; i < rule.cssRules.length; i++) {
          checkRule(rule.cssRules[i]);
        }
      } else if (rule instanceof CSSMediaRule) {
        hasMediaQuery = true;
        for (let i = 0; i < rule.cssRules.length; i++) {
          checkRule(rule.cssRules[i]);
        }
      }
    };

    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          checkRule(rules[j]);
        }
      } catch (e) {
        // Ignore cross-origin errors
      }
    }

    return (hasViewportUnit || hasMediaQuery) && hasContainerUnit;
  });

  expect(hasFallback).toBe(true);
});
