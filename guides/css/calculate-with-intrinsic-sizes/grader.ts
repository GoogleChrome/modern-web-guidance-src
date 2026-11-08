import { test, expect } from '@playwright/test';
import * as fs from 'fs';
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

function parseCSS(cssText: string): { rules: CSSRule[]; comments: string[]; keyframes: string[] } {
  const rules: CSSRule[] = [];
  const comments: string[] = [];
  const keyframes: string[] = [];
  
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
        if (/^@media\b/i.test(selectorOrMedia)) {
          const mediaQuery = selectorOrMedia;
          // Parse nested rules inside media query
          const nested = parseCSS(blockContent);
          for (const nr of nested.rules) {
            nr.media = mediaQuery;
            rules.push(nr);
          }
          keyframes.push(...nested.keyframes);
        } else if (/^@(?:-[a-z]+-)?keyframes\b/i.test(selectorOrMedia)) {
          keyframes.push(blockContent);
        } else if (/^@(?:supports|layer|container|scope|starting-style)\b/i.test(selectorOrMedia)) {
          const nested = parseCSS(blockContent);
          rules.push(...nested.rules);
          keyframes.push(...nested.keyframes);
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
  
  return { rules, comments, keyframes };
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

const SIZE_KEYWORD_RE = /(?<![-\w])size(?![-\w])/i;

function stripParenGroups(input: string): string {
  let out = '';
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

function isCalculatedCalcSize(cs: CalcSizeParts): boolean {
  const exprNoVars = cs.calc.replace(/--[a-zA-Z0-9_-]+/g, 'VAR');
  const hasMath =
    /(?:^|[\s(])[+-](?=[0-9.(]|size(?![-\w])|VAR\b)|[+-]\s|[*/]/i.test(exprNoVars) ||
    /\b(?:clamp|min|max|round|mod|rem|abs|sign|calc)\s*\(/i.test(exprNoVars);
  return (
    hasMath &&
    SIZE_KEYWORD_RE.test(exprNoVars) &&
    !SIZE_KEYWORD_RE.test(stripParenGroups(cs.basis))
  );
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
      const containsSize = SIZE_KEYWORD_RE.test(stripParenGroups(basis));
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
      return SIZE_KEYWORD_RE.test(cs.calc);
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
      const basisOk = ['auto', 'min-content', 'max-content', 'fit-content', 'content', 'any'].some(kw => basis.includes(kw)) && !SIZE_KEYWORD_RE.test(stripParenGroups(basis));
      const calcOk = SIZE_KEYWORD_RE.test(cs.calc);
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

  async function collectStylesText(page: import('@playwright/test').Page): Promise<string> {
    await page.goto(`file://${targetFile}`);
    const inlineStyles = await page.$$eval('style', elements => elements.map(el => el.textContent || ''));
    const html = fs.readFileSync(targetFile, 'utf-8');
    const dir = path.dirname(targetFile);
    const linkedCss: string[] = [];
    for (const match of html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']?stylesheet["']?[^>]*>/gi)) {
      const href = match[1] || match[2];
      if (!href || /^https?:\/\//i.test(href)) continue;
      const cssPath = path.resolve(dir, href);
      if (fs.existsSync(cssPath) && fs.statSync(cssPath).isFile()) {
        linkedCss.push(fs.readFileSync(cssPath, 'utf-8'));
      }
    }
    return [...inlineStyles, ...linkedCss].join('\n');
  }

  test('`calc-size()` is only used for sizing that requires mathematical operations or constraints on an intrinsic basis.', async ({ page }) => {
    const rawCss = await collectStylesText(page);
    const parsed = parseCSS(rawCss);
    const allCssValues = [
      ...parsed.rules.flatMap(r => r.declarations.map(d => d.value)),
      ...parsed.keyframes,
    ].join('\n');
    const calcSizes = extractCalcSizes(allCssValues);

    expect(calcSizes.length).toBeGreaterThan(0);
    expect(calcSizes.every(isCalculatedCalcSize)).toBe(true);
  });

  test('If an animation is present and requires a calculation, it transitions to or from a `calc-size()` value.', async ({ page }) => {
    const rawCss = await collectStylesText(page);
    const parsed = parseCSS(rawCss);
    const decls = parsed.rules.flatMap(r => r.declarations);

    const sizingPropsRe = /\b(?:inline-size|block-size|width|height|min-width|max-width|min-height|max-height|min-inline-size|max-inline-size|min-block-size|max-block-size)\b/i;
    const sizingPropsSet = new Set([
      'inline-size', 'block-size', 'width', 'height',
      'min-width', 'max-width', 'min-height', 'max-height',
      'min-inline-size', 'max-inline-size', 'min-block-size', 'max-block-size',
    ]);

    const keyframeHasSizing = parsed.keyframes.some(kfBody => sizingPropsRe.test(kfBody));
    const keyframeHasCalculatedCalcSize = parsed.keyframes.some(
      kfBody => sizingPropsRe.test(kfBody) && extractCalcSizes(kfBody).some(isCalculatedCalcSize)
    );

    const hasSizingTransition = decls.some(decl =>
      (decl.property === 'transition' || decl.property === 'transition-property') &&
      !/\bnone\b/i.test(decl.value) &&
      (sizingPropsRe.test(decl.value) || /\ball\b/i.test(decl.value))
    );
    const hasCalculatedCalcSize = decls.some(decl =>
      sizingPropsSet.has(decl.property) && extractCalcSizes(decl.value).some(isCalculatedCalcSize)
    );

    const hasAnySizeAnimation = hasSizingTransition || keyframeHasSizing;
    expect(hasAnySizeAnimation).toBe(true);
    expect(hasCalculatedCalcSize || keyframeHasCalculatedCalcSize).toBe(true);
  });

});
