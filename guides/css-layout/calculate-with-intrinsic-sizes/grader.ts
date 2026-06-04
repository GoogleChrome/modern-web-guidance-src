import { test, expect } from '@playwright/test';
import * as path from 'path';

// Parse TARGET_FILE from environment or default to demo.html
const targetFile = process.env.TARGET_FILE 
  ? path.resolve(process.env.TARGET_FILE) 
  : path.resolve('demo.html');

interface CSSRule {
  media: string | null;
  selector: string;
  declarations: Array<{ property: string; value: string }>;
}

function parseCSS(cssText: string): { rules: CSSRule[]; comments: string[] } {
  const rules: CSSRule[] = [];
  const comments: string[] = [];
  
  // Extract and strip comments, saving them
  const commentRegex = /\/\*([\s\S]*?)\*\//g;
  let match;
  while ((match = commentRegex.exec(cssText)) !== null) {
    comments.push(match[1].trim());
  }
  const cleanCSS = cssText.replace(/\/\*([\s\S]*?)\*\//g, '');

  // Helper to parse block declarations
  function parseDeclarations(declText: string) {
    const decls: Array<{ property: string; value: string }> = [];
    let currentDecl = '';
    let parenDepth = 0;
    for (let i = 0; i < declText.length; i++) {
      const char = declText[i];
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
      if (char === ';' && parenDepth === 0) {
        if (currentDecl.trim()) {
          const colonIdx = currentDecl.indexOf(':');
          if (colonIdx !== -1) {
            const prop = currentDecl.substring(0, colonIdx).trim().toLowerCase();
            const val = currentDecl.substring(colonIdx + 1).trim();
            decls.push({ property: prop, value: val });
          }
        }
        currentDecl = '';
      } else {
        currentDecl += char;
      }
    }
    if (currentDecl.trim()) {
      const colonIdx = currentDecl.indexOf(':');
      if (colonIdx !== -1) {
        const prop = currentDecl.substring(0, colonIdx).trim().toLowerCase();
        const val = currentDecl.substring(colonIdx + 1).trim();
        decls.push({ property: prop, value: val });
      }
    }
    return decls;
  }

  // Parse media queries and rules using a stack-based or brace-matching parser
  let index = 0;
  let buffer = '';
  let braceDepth = 0;
  let blockStartIdx = -1;
  let selectorOrMedia = '';

  while (index < cleanCSS.length) {
    const char = cleanCSS[index];
    if (char === '{') {
      if (braceDepth === 0) {
        selectorOrMedia = buffer.trim();
        buffer = '';
        blockStartIdx = index + 1;
      }
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        const blockContent = cleanCSS.substring(blockStartIdx, index);
        if (selectorOrMedia.startsWith('@media')) {
          const mediaQuery = selectorOrMedia;
          // Parse nested rules inside media query
          const nested = parseCSS(blockContent);
          for (const nr of nested.rules) {
            nr.media = mediaQuery;
            rules.push(nr);
          }
        } else {
          const selector = selectorOrMedia;
          const declarations = parseDeclarations(blockContent);
          rules.push({
            media: null,
            selector: selector,
            declarations: declarations
          });
        }
        buffer = '';
      }
    } else {
      buffer += char;
    }
    index++;
  }
  
  return { rules, comments };
}

interface CalcSizeParts {
  basis: string;
  calc: string;
}

function extractCalcSizes(cssText: string): CalcSizeParts[] {
  const list: CalcSizeParts[] = [];
  let index = 0;
  while (index < cssText.length) {
    const idx = cssText.indexOf('calc-size(', index);
    if (idx === -1) break;
    
    let parenDepth = 1;
    let content = '';
    let i = idx + 'calc-size('.length;
    while (i < cssText.length && parenDepth > 0) {
      const char = cssText[i];
      if (char === '(') parenDepth++;
      if (char === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          break;
        }
      }
      content += char;
      i++;
    }
    
    let firstCommaIdx = -1;
    let depth = 0;
    for (let k = 0; k < content.length; k++) {
      if (content[k] === '(') depth++;
      if (content[k] === ')') depth--;
      if (content[k] === ',' && depth === 0) {
        firstCommaIdx = k;
        break;
      }
    }
    
    if (firstCommaIdx !== -1) {
      const basis = content.substring(0, firstCommaIdx).trim();
      const calc = content.substring(firstCommaIdx + 1).trim();
      list.push({ basis, calc });
    }
    
    index = i + 1;
  }
  return list;
}

test.describe('CSS Intrinsic Sizes Grader', () => {

  test('should globally enable keyword interpolation using interpolate-size: allow-keywords', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const parsed = parseCSS(styles.join('\n'));
    
    const hasGlobalInterpolate = parsed.rules.some(rule => {
      const isGlobalSelector = /:root|html|body|\*/.test(rule.selector);
      const hasInterpolateDecl = rule.declarations.some(decl => 
        decl.property === 'interpolate-size' && decl.value.includes('allow-keywords')
      );
      return isGlobalSelector && hasInterpolateDecl;
    });
    
    expect(hasGlobalInterpolate).toBe(true);
  });

  test('should use logical properties inline-size or block-size for elements using calc-size', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const parsed = parseCSS(styles.join('\n'));
    
    // Find all rules that use calc-size
    const calcSizeRules = parsed.rules.filter(rule => 
      rule.declarations.some(decl => decl.value.includes('calc-size'))
    );
    
    // Ensure that all calc-size declarations are on logical properties, and none on physical properties
    const allLogical = calcSizeRules.length > 0 && calcSizeRules.every(rule => {
      return rule.declarations.every(decl => {
        if (decl.value.includes('calc-size')) {
          return decl.property === 'inline-size' || decl.property === 'block-size';
        }
        return true;
      });
    });
    
    expect(allLogical).toBe(true);
  });

  test('should provide a standard fallback property immediately before or alongside each calc-size declaration', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const parsed = parseCSS(styles.join('\n'));
    
    let totalCalcSizeDecls = 0;
    let fallbacksFound = 0;
    
    for (const rule of parsed.rules) {
      const decls = rule.declarations;
      for (let i = 0; i < decls.length; i++) {
        if (decls[i].value.includes('calc-size')) {
          totalCalcSizeDecls++;
          // Check if there is a declaration for the same property BEFORE this decl that does NOT contain calc-size
          let hasFallback = false;
          for (let j = 0; j < i; j++) {
            if (decls[j].property === decls[i].property && !decls[j].value.includes('calc-size')) {
              hasFallback = true;
              break;
            }
          }
          if (hasFallback) {
            fallbacksFound++;
          }
        }
      }
    }
    
    const passed = totalCalcSizeDecls > 0 && fallbacksFound === totalCalcSizeDecls;
    expect(passed).toBe(true);
  });

  test('should ensure calc-size basis is a valid intrinsic keyword and does not contain the size keyword', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const cleanStyles = styles.join('\n').replace(/\/\*([\s\S]*?)\*\//g, '');
    const calcSizes = extractCalcSizes(cleanStyles);
    
    const validBasis = calcSizes.length > 0 && calcSizes.every(cs => {
      const basis = cs.basis.trim().toLowerCase();
      const containsSize = basis.includes('size');
      const isKnownBasis = ['auto', 'min-content', 'max-content', 'fit-content', 'content', 'any'].some(kw => basis.includes(kw)) || /^[0-9]/.test(basis);
      return isKnownBasis && !containsSize;
    });
    
    expect(validBasis).toBe(true);
  });

  test('should reference the size keyword inside the second argument of calc-size', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const cleanStyles = styles.join('\n').replace(/\/\*([\s\S]*?)\*\//g, '');
    const calcSizes = extractCalcSizes(cleanStyles);
    
    const allUseSizeKeyword = calcSizes.length > 0 && calcSizes.every(cs => {
      const calc = cs.calc.toLowerCase();
      return calc.includes('size');
    });
    
    expect(allUseSizeKeyword).toBe(true);
  });

  test('should demonstrate varied mathematical operations within calc-size calculations', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const cleanStyles = styles.join('\n').replace(/\/\*([\s\S]*?)\*\//g, '');
    const calcSizes = extractCalcSizes(cleanStyles);
    
    const validCalcSizes = calcSizes.filter(cs => {
      const basis = cs.basis.trim().toLowerCase();
      const calc = cs.calc.toLowerCase();
      const basisOk = ['auto', 'min-content', 'max-content', 'fit-content', 'content', 'any'].some(kw => basis.includes(kw)) && !basis.includes('size');
      const calcOk = calc.includes('size');
      return basisOk && calcOk;
    });
    
    let hasAddition = false;
    let hasMultiplication = false;
    let hasMathFunction = false;
    
    for (const cs of validCalcSizes) {
      const calc = cs.calc.toLowerCase();
      if (calc.includes('+') || calc.includes('-')) {
        hasAddition = true;
      }
      if (calc.includes('*') || calc.includes('/')) {
        hasMultiplication = true;
      }
      if (['min(', 'max(', 'clamp('].some(fn => calc.includes(fn))) {
        hasMathFunction = true;
      }
    }
    
    const count = (hasAddition ? 1 : 0) + (hasMultiplication ? 1 : 0) + (hasMathFunction ? 1 : 0);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should declare a prefers-reduced-motion media query adjusting transitions', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const parsed = parseCSS(styles.join('\n'));
    
    const hasReducedMotionQuery = parsed.rules.some(rule => 
      rule.media !== null && rule.media.toLowerCase().includes('prefers-reduced-motion')
    );
    
    expect(hasReducedMotionQuery).toBe(true);
  });

  test('should document that interpolation between two different intrinsic keywords is not supported', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const styles = await page.$$eval('style', (elements) => elements.map(el => el.textContent || ''));
    const parsed = parseCSS(styles.join('\n'));
    
    const hasKeywordInterpolationNote = parsed.comments.some(comment => {
      const commentLower = comment.toLowerCase();
      return commentLower.includes('interpolation');
    });
    
    expect(hasKeywordInterpolationNote).toBe(true);
  });

});
