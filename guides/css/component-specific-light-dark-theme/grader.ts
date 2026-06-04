import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';
const url = `file://${targetFile}`;

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

// Helper to parse light-dark() arguments from a string respecting nested parentheses
function getLightDarkCalls(cssText: string): string[][] {
  const calls: string[][] = [];
  let index = 0;
  while (true) {
    index = cssText.indexOf('light-dark(', index);
    if (index === -1) break;
    
    let parenCount = 1;
    let currentArg = '';
    const args: string[] = [];
    let i = index + 'light-dark('.length;
    while (i < cssText.length && parenCount > 0) {
      const char = cssText[i];
      if (char === '(') {
        parenCount++;
        currentArg += char;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0) {
          args.push(currentArg.trim());
        } else {
          currentArg += char;
        }
      } else if (char === ',' && parenCount === 1) {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
      i++;
    }
    calls.push(args);
    index = i;
  }
  return calls;
}

// 1. Outside of @supports feature detection, light-dark() is used with var() references for the two color arguments, not raw color values
test('light-dark() outside of supports uses var references and not raw colors', async ({ page }) => {
  const result = await page.evaluate((getLightDarkCallsStr) => {
    const getLightDarkCallsFn = new Function(`return ${getLightDarkCallsStr}`)();
    const violations: { selector: string; cssText: string; callArgs: string[] }[] = [];
    
    function traverse(cssRules: CSSRuleList, insideSupportsLightDark = false) {
      for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule.type === 12) { // CSSRule.SUPPORTS_RULE
          const supportsRule = rule as CSSSupportsRule;
          const cond = supportsRule.conditionText || '';
          const isSupportsLD = cond.includes('light-dark');
          traverse(supportsRule.cssRules, insideSupportsLightDark || isSupportsLD);
        } else if (rule.type === 4) { // CSSRule.MEDIA_RULE
          const mediaRule = rule as CSSMediaRule;
          traverse(mediaRule.cssRules, insideSupportsLightDark);
        } else if (rule.type === 1) { // CSSRule.STYLE_RULE
          const styleRule = rule as CSSStyleRule;
          if (!insideSupportsLightDark) {
            for (let j = 0; j < styleRule.style.length; j++) {
              const prop = styleRule.style[j];
              const val = styleRule.style.getPropertyValue(prop);
              if (val && val.includes('light-dark')) {
                const calls = getLightDarkCallsFn(val);
                for (const args of calls) {
                  const hasRawColor = args.some((arg: string) => {
                    const trimmed = arg.trim();
                    return !trimmed.startsWith('var(') || !trimmed.endsWith(')');
                  });
                  if (hasRawColor) {
                    violations.push({
                      selector: styleRule.selectorText,
                      cssText: `${prop}: ${val}`,
                      callArgs: args
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        if (sheet.cssRules) {
          traverse(sheet.cssRules);
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }

    return violations;
  }, getLightDarkCalls.toString());

  expect(result).toEqual([]);
});

// 2. The implementation uses the color-scheme property to force a specific theme on a component or section
test('uses color-scheme property to force a theme on a component or section', async ({ page }) => {
  const isCorrect = await page.evaluate(() => {
    let foundValid = false;
    let foundColorSchemeOverride = false;
    
    function traverse(cssRules: CSSRuleList) {
      for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule.type === 1) { // CSSRule.STYLE_RULE
          const styleRule = rule as CSSStyleRule;
          const sel = styleRule.selectorText || '';
          const isGlobal = sel.includes(':root') || sel.includes('html') || sel.includes('body');
          if (!isGlobal && styleRule.style.colorScheme) {
            foundColorSchemeOverride = true;
            const hasBg = styleRule.style.backgroundColor || styleRule.style.background;
            const hasColor = styleRule.style.color;
            if (hasBg || hasColor) {
              foundValid = true;
            }
          }
        } else if (rule.type === 4 || rule.type === 12) {
          traverse((rule as any).cssRules);
        }
      }
    }
    
    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        if (sheet.cssRules) {
          traverse(sheet.cssRules);
        }
      } catch (e) {}
    }
    
    return foundColorSchemeOverride && foundValid;
  });

  expect(isCorrect).toBe(true);
});

// 3. color-scheme overrides are only applied to elements that also have a background-color
test('color-scheme overrides are only applied to elements with a background-color', async ({ page }) => {
  const violationElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const violations: string[] = [];
    for (const el of elements) {
      const parent = el.parentElement;
      if (!parent) continue;
      const style = window.getComputedStyle(el);
      const parentStyle = window.getComputedStyle(parent);
      if (style.colorScheme !== parentStyle.colorScheme) {
        const bg = style.backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || !bg) {
          violations.push(`${el.tagName.toLowerCase()}.${el.className}`);
        }
      }
    }
    return violations;
  });

  expect(violationElements).toEqual([]);
});

// 4. Inherited properties that use light-dark() tokens are explicitly re-applied on elements that force color-scheme
test('re-specifies inherited light-dark properties on scheme-overriding elements to avoid inheritance footgun', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  
  const result = await page.evaluate(() => {
    const forcedDarkElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      const parent = el.parentElement;
      if (!parent) return false;
      const parentStyle = window.getComputedStyle(parent);
      return style.colorScheme === 'dark' && parentStyle.colorScheme !== 'dark';
    });

    const rootStyle = window.getComputedStyle(document.documentElement);
    const rootTextColor = rootStyle.color;

    const violations: string[] = [];
    for (const el of forcedDarkElements) {
      const style = window.getComputedStyle(el);
      if (style.color === rootTextColor) {
        violations.push(el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''));
      }
    }
    return {
      foundCount: forcedDarkElements.length,
      violations
    };
  });

  expect(result.foundCount).toBeGreaterThan(0);
  expect(result.violations).toEqual([]);
});

// 5. Fallback strategies are provided for browsers that do not support light-dark(), using prefers-color-scheme media queries
test('provides prefers-color-scheme fallback media queries in stylesheets', async ({ page }) => {
  const hasPrefersColorScheme = await page.evaluate(() => {
    let found = false;
    function traverse(cssRules: CSSRuleList) {
      for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule.type === 4) { // CSSRule.MEDIA_RULE
          const mediaRule = rule as CSSMediaRule;
          if (mediaRule.media.mediaText.includes('prefers-color-scheme')) {
            found = true;
          }
        }
        if ((rule as any).cssRules) {
          traverse((rule as any).cssRules);
        }
      }
    }
    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        if (sheet.cssRules) {
          traverse(sheet.cssRules);
        }
      } catch (e) {}
    }
    return found;
  });

  expect(hasPrefersColorScheme).toBe(true);
});

// 6. Progressive enhancement is used via @supports (color: light-dark(white, black))
test('uses progressive enhancement via @supports for light-dark() support', async ({ page }) => {
  const hasSupportsLightDark = await page.evaluate(() => {
    let found = false;
    function traverse(cssRules: CSSRuleList) {
      for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule.type === 12) { // CSSRule.SUPPORTS_RULE
          const supportsRule = rule as CSSSupportsRule;
          if (supportsRule.conditionText.includes('light-dark')) {
            found = true;
          }
        }
        if ((rule as any).cssRules) {
          traverse((rule as any).cssRules);
        }
      }
    }
    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const sheet = document.styleSheets[i];
        if (sheet.cssRules) {
          traverse(sheet.cssRules);
        }
      } catch (e) {}
    }
    return found;
  });

  expect(hasSupportsLightDark).toBe(true);
});

// 7. light-dark() is only used for supported types (colors) and not for non-color properties like padding or margin
test('only uses light-dark() on color properties or custom variables', async ({ page }) => {
  const invalidProps = await page.evaluate(() => {
    const rawText = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '').join(String.fromCharCode(10));
    const stylesText = rawText.replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = stylesText.match(/([a-zA-Z0-9-]+)\s*:\s*([^;}]*light-dark[^;}]*)/g) || [];
    const violations: string[] = [];
    
    for (const dec of declarations) {
      const parts = dec.split(':');
      const propName = parts[0].trim();
      const isCustomProp = propName.startsWith('--');
      const isColorProp = [
        'color', 'background-color', 'background', 'border-color', 'border',
        'outline-color', 'text-decoration-color', 'box-shadow', 'accent-color',
        'fill', 'stroke', 'caret-color', 'text-shadow', 'column-rule-color'
      ].includes(propName);
      
      if (!isCustomProp && !isColorProp) {
        violations.push(dec);
      }
    }
    return violations;
  });

  expect(invalidProps).toEqual([]);
});

// 8. Custom properties intended to dynamically resolve with light-dark() are NOT registered using @property with a <color> type
test('does not register light-dark properties as CSS @property with color type', async ({ page }) => {
  const registeredColorVarsWithLightDark = await page.evaluate(() => {
    const rawText = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '').join(String.fromCharCode(10));
    const stylesText = rawText.replace(/\/\*[\s\S]*?\*\//g, '');
    const propertyBlocks = stylesText.match(/@property\s+(--[a-zA-Z0-9_-]+)\s*\{[^}]+\}/g) || [];
    const colorProperties: string[] = [];
    
    for (const block of propertyBlocks) {
      const nameMatch = block.match(/@property\s+(--[a-zA-Z0-9_-]+)/);
      if (nameMatch) {
        const propName = nameMatch[1];
        if (block.includes('<color>')) {
          colorProperties.push(propName);
        }
      }
    }

    const violations: string[] = [];
    const assignMatches = stylesText.match(/(--[a-zA-Z0-9_-]+)\s*:\s*[^;]*light-dark/g) || [];
    for (const match of assignMatches) {
      const varName = match.split(':')[0].trim();
      if (colorProperties.includes(varName)) {
        violations.push(varName);
      }
    }
    return violations;
  });

  expect(registeredColorVarsWithLightDark).toEqual([]);
});

// 9. Each light-dark() call contains exactly two color arguments
test('each light-dark() call contains exactly two arguments', async ({ page }) => {
  const invalidCalls = await page.evaluate((getLightDarkCallsStr) => {
    const getLightDarkCallsFn = new Function(`return ${getLightDarkCallsStr}`)();
    const rawText = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '').join(String.fromCharCode(10));
    const stylesText = rawText.replace(/\/\*[\s\S]*?\*\//g, '');
    const calls = getLightDarkCallsFn(stylesText);
    const badCalls = calls.filter((args: string[]) => args.length !== 2);
    return badCalls;
  }, getLightDarkCalls.toString());

  expect(invalidCalls).toEqual([]);
});

// 10. Forced dark component retains dark-theme computed colors even when system theme is light
test('forced dark component retains dark-theme computed colors even when system theme is light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  
  const colors = await page.evaluate(() => {
    const forcedDark = Array.from(document.querySelectorAll('*')).find(el => {
      const style = window.getComputedStyle(el);
      const parent = el.parentElement;
      if (!parent) return false;
      const parentStyle = window.getComputedStyle(parent);
      return style.colorScheme === 'dark' && parentStyle.colorScheme !== 'dark';
    });
    if (!forcedDark) return null;
    
    const style = window.getComputedStyle(forcedDark);
    return {
      bgColor: style.backgroundColor,
      color: style.color
    };
  });

  expect(colors).not.toBeNull();
  if (colors) {
    const matchBg = colors.bgColor.match(/\d+/g);
    if (matchBg) {
      const [r, g, b] = matchBg.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      expect(brightness).toBeLessThan(100);
    } else {
      throw new Error(`Could not parse background-color: ${colors.bgColor}`);
    }

    const matchText = colors.color.match(/\d+/g);
    if (matchText) {
      const [r, g, b] = matchText.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      expect(brightness).toBeGreaterThan(150);
    } else {
      throw new Error(`Could not parse color: ${colors.color}`);
    }
  }
});

// 11. Forced light component retains light-theme computed colors even when system theme is dark
test('forced light component retains light-theme computed colors even when system theme is dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  
  const colors = await page.evaluate(() => {
    const card = document.querySelector('.themed-card');
    if (!card) return null;
    
    card.classList.add('force-light');
    
    const style = window.getComputedStyle(card);
    return {
      bgColor: style.backgroundColor,
      color: style.color
    };
  });

  expect(colors).not.toBeNull();
  if (colors) {
    const matchBg = colors.bgColor.match(/\d+/g);
    if (matchBg) {
      const [r, g, b] = matchBg.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      expect(brightness).toBeGreaterThan(150);
    } else {
      throw new Error(`Could not parse background-color: ${colors.bgColor}`);
    }

    const matchText = colors.color.match(/\d+/g);
    if (matchText) {
      const [r, g, b] = matchText.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      expect(brightness).toBeLessThan(100);
    } else {
      throw new Error(`Could not parse color: ${colors.color}`);
    }
  }
});
