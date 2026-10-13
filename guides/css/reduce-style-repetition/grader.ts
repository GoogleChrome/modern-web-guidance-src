import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getExternalCssText(targetFilePath: string): string {
  if (!fs.existsSync(targetFilePath)) return '';
  const html = fs.readFileSync(targetFilePath, 'utf-8');
  const baseDir = path.dirname(targetFilePath);
  let externalCss = '';
  const linkRegex = /<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(match[0]);
    if (hrefMatch) {
      const cssPath = path.resolve(baseDir, hrefMatch[1]);
      if (fs.existsSync(cssPath)) {
        externalCss += fs.readFileSync(cssPath, 'utf-8') + '\n';
      }
    }
  }
  return externalCss;
}

// Common interface for parsed declarations
interface CSSDeclaration {
  property: string;
  value: string;
}

// Common interface for parsed rule blocks
interface CSSRuleBlock {
  selector: string;
  bodyText: string;
}

test.describe("CSS Function Grader", () => {

  // A helper function to gather CSS info in browser context
  const getCssInfoInBrowser = (externalCssText = '') => {
    // 1. Parser to extract blocks with curly braces (handles nested structures like @function or @media)
    function parseCSS(cssText: string): CSSRuleBlock[] {
      // Strip comments
      cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
      const rules: CSSRuleBlock[] = [];
      let pos = 0;
      while (pos < cssText.length) {
        // Skip whitespace
        while (pos < cssText.length && /\s/.test(cssText[pos])) pos++;
        if (pos >= cssText.length) break;
        
        // Read selector / head
        const start = pos;
        let braceCount = 0;
        while (pos < cssText.length) {
          if (cssText[pos] === '{') {
            braceCount++;
            pos++;
            break;
          }
          pos++;
        }
        const selector = cssText.substring(start, pos - 1).trim();
        
        // Read body, tracking braces
        const bodyStart = pos;
        while (pos < cssText.length && braceCount > 0) {
          if (cssText[pos] === '{') {
            braceCount++;
          } else if (cssText[pos] === '}') {
            braceCount--;
          }
          pos++;
        }
        const bodyText = cssText.substring(bodyStart, pos - 1).trim();
        rules.push({ selector, bodyText });
      }
      return rules;
    }

    function flattenCSSRules(cssText: string): CSSRuleBlock[] {
      const topRules = parseCSS(cssText);
      const result: CSSRuleBlock[] = [];
      for (const rule of topRules) {
        result.push(rule);
        if (
          rule.selector.startsWith('@') &&
          !/^@(?:function|keyframes|-webkit-keyframes)\b/i.test(rule.selector)
        ) {
          result.push(...flattenCSSRules(rule.bodyText));
        }
      }
      return result;
    }

    // 2. Parser to extract individual property declarations
    function parseDeclarations(bodyText: string): CSSDeclaration[] {
      const decls: string[] = [];
      let pos = 0;
      let start = 0;
      let inParens = 0;
      while (pos < bodyText.length) {
        const char = bodyText[pos];
        if (char === '(') inParens++;
        else if (char === ')') inParens--;
        else if (char === ';' && inParens === 0) {
          decls.push(bodyText.substring(start, pos).trim());
          start = pos + 1;
        }
        pos++;
      }
      if (start < bodyText.length) {
        const last = bodyText.substring(start).trim();
        if (last) decls.push(last);
      }
      return decls
        .map(decl => {
          const colonIdx = decl.indexOf(':');
          if (colonIdx === -1) return null;
          return {
            property: decl.substring(0, colonIdx).trim().toLowerCase(),
            value: decl.substring(colonIdx + 1).trim()
          };
        })
        .filter((item): item is CSSDeclaration => item !== null);
    }

    // Gather raw CSS text from external stylesheets and style elements
    let cssText = (externalCssText || '') + String.fromCharCode(10);
    const styleElements = document.querySelectorAll('style');
    for (const styleEl of Array.from(styleElements)) {
      cssText += (styleEl.textContent || '') + String.fromCharCode(10);
    }
    
    const rawRules = flattenCSSRules(cssText);
    
    // Find custom function names
    const functions: string[] = [];
    for (const rule of rawRules) {
      const m = rule.selector.match(/^@function\s+(--[a-zA-Z0-9_-]+)/);
      if (m) {
        functions.push(m[1]);
      }
    }

    // Map rules to elements
    interface ElementRuleEntry {
      selector: string;
      elements: Element[];
      decls: CSSDeclaration[];
    }
    const elementDecls: ElementRuleEntry[] = [];
    for (const rule of rawRules) {
      if (rule.selector.startsWith('@')) continue;
      try {
        const elements = Array.from(document.querySelectorAll(rule.selector));
        if (elements.length > 0) {
          elementDecls.push({
            selector: rule.selector,
            elements,
            decls: parseDeclarations(rule.bodyText)
          });
        }
      } catch (e) {
        // Ignored for complex selectors
      }
    }

    return {
      functions,
      rawRules,
      elementDecls,
      parseDeclarations // expose helper for inline calls
    };
  };

  test("The body element must have a background-image that contains a linear-gradient generated by a CSS @function", async ({ page }) => {
    const rawTarget = process.env.TARGET_FILE || '/private/tmp/ghh-grader-gen-k79soq/work/guides/user-experience/reduce-style-repetition/demo.html';
    const externalCssText = getExternalCssText(rawTarget);
    const filePath = `file://${rawTarget}`;
    await page.goto(filePath);

    const errorMsg = await page.evaluate(({ getCssInfoStr, externalCssText }) => {
      // Evaluate the helper function from string
      const getCssInfo = new Function('ext', `return (${getCssInfoStr})(ext)`)(externalCssText);
      const bodyEl = document.body;
      if (!bodyEl) return 'Body element not found';

      // 1. Verify computed background-image
      const computedBg = window.getComputedStyle(bodyEl).backgroundImage;
      if (!computedBg || !computedBg.includes('linear-gradient')) {
        return `Body computed background-image is not a gradient: "${computedBg}"`;
      }

      // 2. Parse CSS
      const { functions, elementDecls } = getCssInfo;
      if (functions.length === 0) {
        return 'No CSS @functions defined in the stylesheets.';
      }

      // 3. Verify body uses a custom function for background
      const usesFunction = elementDecls.some((entry: any) => {
        if (!entry.elements.includes(bodyEl)) return false;
        return entry.decls.some((decl: any) => {
          if (decl.property !== 'background' && decl.property !== 'background-image') return false;
          return functions.some((fnName: string) => decl.value.includes(fnName + '('));
        });
      });

      if (!usesFunction) {
        return 'No CSS rule applying to the body element uses a custom @function for background or background-image.';
      }

      return null;
    }, { getCssInfoStr: getCssInfoInBrowser.toString(), externalCssText });

    expect(errorMsg).toBeNull();
  });

  test("All h2 elements must have a background-image that contains a linear-gradient generated by a CSS @function", async ({ page }) => {
    const rawTarget = process.env.TARGET_FILE || '/private/tmp/ghh-grader-gen-k79soq/work/guides/user-experience/reduce-style-repetition/demo.html';
    const externalCssText = getExternalCssText(rawTarget);
    const filePath = `file://${rawTarget}`;
    await page.goto(filePath);

    const errorMsg = await page.evaluate(({ getCssInfoStr, externalCssText }) => {
      const getCssInfo = new Function('ext', `return (${getCssInfoStr})(ext)`)(externalCssText);
      const h2Elements = Array.from(document.querySelectorAll('h2'));
      if (h2Elements.length === 0) {
        return 'No h2 elements found in the document.';
      }

      // 1. Verify computed background-image
      for (let i = 0; i < h2Elements.length; i++) {
        const h2 = h2Elements[i];
        const computedBg = window.getComputedStyle(h2).backgroundImage;
        if (!computedBg || !computedBg.includes('linear-gradient')) {
          return `h2 element at index ${i} does not have a gradient in computed background-image: "${computedBg}"`;
        }
      }

      // 2. Parse CSS
      const { functions, elementDecls } = getCssInfo;
      if (functions.length === 0) {
        return 'No CSS @functions defined in the stylesheets.';
      }

      // 3. Verify h2 uses a custom function for background
      for (let i = 0; i < h2Elements.length; i++) {
        const h2 = h2Elements[i];
        const usesFunction = elementDecls.some((entry: any) => {
          if (!entry.elements.includes(h2)) return false;
          return entry.decls.some((decl: any) => {
            if (decl.property !== 'background' && decl.property !== 'background-image') return false;
            return functions.some((fnName: string) => decl.value.includes(fnName + '('));
          });
        });
        if (!usesFunction) {
          return `h2 element at index ${i} is not styled using a custom @function for background or background-image.`;
        }
      }

      return null;
    }, { getCssInfoStr: getCssInfoInBrowser.toString(), externalCssText });

    expect(errorMsg).toBeNull();
  });

  test("When the viewport is 400px wide, the main element's grid-template-columns must use a function to resolve to a single column (e.g., 1fr)", async ({ page }) => {
    const rawTarget = process.env.TARGET_FILE || '/private/tmp/ghh-grader-gen-k79soq/work/guides/user-experience/reduce-style-repetition/demo.html';
    const externalCssText = getExternalCssText(rawTarget);
    const filePath = `file://${rawTarget}`;
    await page.goto(filePath);

    await page.setViewportSize({ width: 400, height: 600 });

    const errorMsg = await page.evaluate(({ getCssInfoStr, externalCssText }) => {
      const getCssInfo = new Function('ext', `return (${getCssInfoStr})(ext)`)(externalCssText);
      const candidates = [
        document.querySelector('main'),
        document.querySelector('main .grid'),
        document.querySelector('.grid'),
      ].filter((el): el is Element => el !== null);
      if (candidates.length === 0) return 'main element not found.';

      const { functions, elementDecls } = getCssInfo;
      if (functions.length === 0) {
        return 'No CSS @functions defined in the stylesheets.';
      }

      const matchingCandidate = candidates.find((el) => {
        const gridStyle = window.getComputedStyle(el).gridTemplateColumns;
        const tracks = gridStyle.trim().split(/\s+/).filter(Boolean);
        if (tracks.length !== 1 || gridStyle === 'none') return false;
        return elementDecls.some((entry: any) => {
          if (!entry.elements.includes(el)) return false;
          return entry.decls.some((decl: any) => {
            if (decl.property !== 'grid-template-columns' && decl.property !== 'grid') return false;
            return functions.some((fnName: string) => decl.value.includes(fnName + '('));
          });
        });
      });

      if (!matchingCandidate) {
        return 'Neither main nor main .grid uses a custom @function for grid-template-columns that resolves to 1 column at 400px viewport.';
      }

      return null;
    }, { getCssInfoStr: getCssInfoInBrowser.toString(), externalCssText });

    expect(errorMsg).toBeNull();
  });

  test("When the viewport is 1000px wide, the main element's grid-template-columns must use a function to resolve to two columns of equal width", async ({ page }) => {
    const rawTarget = process.env.TARGET_FILE || '/private/tmp/ghh-grader-gen-k79soq/work/guides/user-experience/reduce-style-repetition/demo.html';
    const externalCssText = getExternalCssText(rawTarget);
    const filePath = `file://${rawTarget}`;
    await page.goto(filePath);

    await page.setViewportSize({ width: 1000, height: 600 });

    const errorMsg = await page.evaluate(({ getCssInfoStr, externalCssText }) => {
      const getCssInfo = new Function('ext', `return (${getCssInfoStr})(ext)`)(externalCssText);
      const candidates = [
        document.querySelector('main'),
        document.querySelector('main .grid'),
        document.querySelector('.grid'),
      ].filter((el): el is Element => el !== null);
      if (candidates.length === 0) return 'main element not found.';

      const { functions, elementDecls } = getCssInfo;
      if (functions.length === 0) {
        return 'No CSS @functions defined in the stylesheets.';
      }

      const matchingCandidate = candidates.find((el) => {
        const gridStyle = window.getComputedStyle(el).gridTemplateColumns;
        const tracks = gridStyle.trim().split(/\s+/).filter(Boolean);
        if (tracks.length !== 2 || tracks[0] !== tracks[1]) return false;
        return elementDecls.some((entry: any) => {
          if (!entry.elements.includes(el)) return false;
          return entry.decls.some((decl: any) => {
            if (decl.property !== 'grid-template-columns' && decl.property !== 'grid') return false;
            return functions.some((fnName: string) => decl.value.includes(fnName + '('));
          });
        });
      });

      if (!matchingCandidate) {
        return 'Neither main nor main .grid uses a custom @function for grid-template-columns that resolves to 2 equal columns at 1000px viewport.';
      }

      return null;
    }, { getCssInfoStr: getCssInfoInBrowser.toString(), externalCssText });

    expect(errorMsg).toBeNull();
  });

  test("All uses of functions must be preceded with a fallback value for the same property", async ({ page }) => {
    const rawTarget = process.env.TARGET_FILE || '/private/tmp/ghh-grader-gen-k79soq/work/guides/user-experience/reduce-style-repetition/demo.html';
    const externalCssText = getExternalCssText(rawTarget);
    const filePath = `file://${rawTarget}`;
    await page.goto(filePath);

    const errorMsg = await page.evaluate(({ getCssInfoStr, externalCssText }) => {
      const getCssInfo = new Function('ext', `return (${getCssInfoStr})(ext)`)(externalCssText);
      const { functions, rawRules, parseDeclarations } = getCssInfo;

      if (functions.length === 0) {
        return 'No CSS @functions defined in the stylesheets.';
      }

      const isBgProp = (p: string) =>
        p === 'background' || p === 'background-image' || p === 'background-color';

      let totalFunctionUses = 0;

      for (const rule of rawRules) {
        if (rule.selector.startsWith('@')) continue;
        const decls = parseDeclarations(rule.bodyText);
        
        for (let i = 0; i < decls.length; i++) {
          const decl = decls[i];
          const usesFn = functions.some((fnName: string) => decl.value.includes(fnName + '('));
          if (usesFn) {
            totalFunctionUses++;
            // Check if there is a declaration before this one with the same (or shorthand/longhand background) property that does NOT use any function
            let hasFallback = false;
            for (let j = 0; j < i; j++) {
              const prevDecl = decls[j];
              const sameOrEquivalent =
                prevDecl.property === decl.property ||
                (isBgProp(prevDecl.property) && isBgProp(decl.property));
              if (sameOrEquivalent) {
                const prevUsesFn = functions.some((fnName: string) => prevDecl.value.includes(fnName + '('));
                if (!prevUsesFn) {
                  hasFallback = true;
                  break;
                }
              }
            }
            if (!hasFallback) {
              return `Function use "${decl.property}: ${decl.value}" is not preceded by a fallback value for "${decl.property}" in rule "${rule.selector}".`;
            }
          }
        }
      }

      if (totalFunctionUses === 0) {
        return 'No CSS @function calls were found in stylesheet declarations.';
      }

      return null;
    }, { getCssInfoStr: getCssInfoInBrowser.toString(), externalCssText });

    expect(errorMsg).toBeNull();
  });

});
