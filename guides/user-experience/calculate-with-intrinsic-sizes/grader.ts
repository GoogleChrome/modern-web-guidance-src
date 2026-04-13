import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe('Calculate with Intrinsic Sizes Expectations', () => {

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

  test('should use calc-size() with an intrinsic keyword and the "size" keyword', async ({ page }) => {
    const calcSizeInfo = await page.evaluate(() => {
      const results = [];

      // Helper to parse calc-size without complex regex
      function parseCalcSize(text: string) {
        const startToken = 'calc-size(';
        let searchIdx = 0;
        const matches = [];

        while (true) {
          const startIdx = text.indexOf(startToken, searchIdx);
          if (startIdx === -1) break;

          let depth = 0;
          let endIdx = -1;
          for (let i = startIdx + startToken.length; i < text.length; i++) {
            if (text[i] === '(') depth++;
            else if (text[i] === ')') {
              if (depth === 0) {
                endIdx = i;
                break;
              }
              depth--;
            }
          }

          if (endIdx !== -1) {
            const content = text.substring(startIdx + startToken.length, endIdx);
            const firstComma = content.indexOf(',');
            if (firstComma !== -1) {
              matches.push({
                basis: content.substring(0, firstComma).trim(),
                calculation: content.substring(firstComma + 1).trim()
              });
            }
            searchIdx = endIdx + 1;
          } else {
            searchIdx = startIdx + 1;
          }
        }
        return matches;
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const matches = parseCalcSize(rule.cssText);
              results.push(...matches);
            }
          }
        } catch (e) {}
      }
      return results;
    });

    expect(calcSizeInfo.length).toBeGreaterThan(0);
    
    const intrinsicKeywords = ['auto', 'min-content', 'max-content', 'fit-content', 'content'];
    const validRule = calcSizeInfo.find(info => {
      const hasIntrinsicBasis = intrinsicKeywords.some(kw => info.basis.includes(kw));
      const hasSizeInCalculation = info.calculation.includes('size');
      const hasSizeInBasis = info.basis.includes('size');
      
      return hasIntrinsicBasis && hasSizeInCalculation && !hasSizeInBasis;
    });

    expect(validRule, 'Should find a calc-size() call with an intrinsic basis, the "size" keyword in the calculation, and NO "size" keyword in the basis').toBeDefined();
  });

  test('should include mathematical operations or constraints within calc-size()', async ({ page }) => {
    const hasMathOrConstraint = await page.evaluate(() => {
      const mathFuncs = ['clamp', 'min', 'max', 'round'];
      const operators = ['+', '-', '*', '/'];

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const text = rule.cssText;
              if (!text.includes('calc-size')) continue;

              // Simple substring check for math indicators within the calc-size area
              const startIdx = text.indexOf('calc-size(');
              const endIdx = text.lastIndexOf(')');
              const calculationArea = text.substring(startIdx, endIdx);

              const hasFunc = mathFuncs.some(f => calculationArea.includes(f + '('));
              const hasOp = operators.some(op => calculationArea.includes(op));

              if (hasFunc || hasOp) return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(hasMathOrConstraint, 'The calc-size() calculation should include mathematical operations or functions').toBe(true);
  });

  test('should use logical properties (inline-size or block-size) for dimensions', async ({ page }) => {
    const usesLogicalProperties = await page.evaluate(() => {
      const logicalProps = ['inline-size', 'block-size', 'min-inline-size', 'min-block-size', 'max-inline-size', 'max-block-size'];
      
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              for (const prop of logicalProps) {
                if (rule.style.getPropertyValue(prop)) return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(usesLogicalProperties).toBe(true);
  });

  test('should provide a fallback property for browsers that do not support calc-size()', async ({ page }) => {
    const hasFallback = await page.evaluate(() => {
      const sizingProps = ['inline-size', 'block-size', 'width', 'height'];

      function checkContent(text: string) {
        // Strip comments first to avoid false positives/negatives
        let cleanText = '';
        let i = 0;
        while (i < text.length) {
          if (text[i] === '/' && text[i+1] === '*') {
            const endComment = text.indexOf('*/', i + 2);
            if (endComment === -1) break;
            i = endComment + 2;
          } else {
            cleanText += text[i];
            i++;
          }
        }

        // Find blocks delimited by { }
        let searchIdx = 0;
        while (true) {
          const startBrace = cleanText.indexOf('{', searchIdx);
          if (startBrace === -1) break;
          const endBrace = cleanText.indexOf('}', startBrace);
          if (endBrace === -1) break;

          const body = cleanText.substring(startBrace + 1, endBrace);
          const declarations = body.split(';').map(d => d.trim()).filter(Boolean);
          
          const parsed = [];
          for (const d of declarations) {
            const colonIdx = d.indexOf(':');
            if (colonIdx !== -1) {
              parsed.push({
                prop: d.substring(0, colonIdx).trim(),
                val: d.substring(colonIdx + 1).trim()
              });
            }
          }

          for (const p of sizingProps) {
            const matches = parsed.filter(d => d.prop === p);
            if (matches.length >= 2) {
              const hasCalc = matches.some(m => m.val.indexOf('calc-size') !== -1);
              const hasStandard = matches.some(m => m.val.indexOf('calc-size') === -1);
              if (hasCalc && hasStandard) return true;
            }
          }
          searchIdx = endBrace + 1;
        }
        return false;
      }

      // 1. Check style tags (raw source)
      const styleTags = Array.from(document.querySelectorAll('style'));
      for (const tag of styleTags) {
        const text = tag.textContent || '';
        if (checkContent(text)) return true;
      }

      // 2. Check CSSOM (fallback for external or other cases)
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              if (checkContent(rule.cssText)) return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(hasFallback, 'Should provide a fallback property before the calc-size() declaration').toBe(true);
  });

  test('if an animation or transition is present, it should target the sizing property', async ({ page }) => {
    const animationInfo = await page.evaluate(() => {
      const sizingProps = ['inline-size', 'block-size', 'width', 'height', 'all'];
      let foundTransition = false;
      let targetsSizing = false;

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const transition = rule.style.transitionProperty;
              if (transition && transition !== 'none') {
                const props = transition.split(',').map(p => p.trim());
                if (props.length > 0 && props[0] !== '') {
                  foundTransition = true;
                  if (props.some(p => sizingProps.includes(p))) {
                    targetsSizing = true;
                  }
                }
              }
              if (rule.style.animationName && rule.style.animationName !== 'none') {
                foundTransition = true;
                targetsSizing = true; 
              }
            }
          }
        } catch (e) {}
      }
      
      return { foundTransition, targetsSizing };
    });

    if (animationInfo.foundTransition) {
      expect(animationInfo.targetsSizing, 'Transitions or animations should target sizing properties').toBe(true);
    } else {
      test.skip();
    }
  });

});
