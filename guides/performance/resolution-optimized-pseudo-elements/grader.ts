import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

// Re-use helper function to evaluate requirements in the page context
async function runEvaluation(page: any) {
  return await page.evaluate(async () => {
    function parseCSSRules(css: string) {
      const cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const rules = [];
      let depth = 0;
      let currentToken = '';
      let selector = '';
      let blockContent = '';
      
      for (let i = 0; i < cleanCSS.length; i++) {
        const char = cleanCSS[i];
        if (char === '{') {
          if (depth === 0) {
            selector = currentToken.trim();
            currentToken = '';
          } else {
            currentToken += char;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            blockContent = currentToken.trim();
            currentToken = '';
            rules.push({ selector, blockContent });
          } else {
            currentToken += char;
          }
        } else {
          currentToken += char;
        }
      }
      return rules;
    }

    function getAllDeclarations(css: string): any[] {
      const rules = parseCSSRules(css);
      const declarations: any[] = [];
      
      for (const rule of rules) {
        if (rule.selector.startsWith('@media') || rule.selector.startsWith('@supports')) {
          declarations.push(...getAllDeclarations(rule.blockContent));
        } else {
          declarations.push(rule);
        }
      }
      return declarations;
    }

    async function getCSSContents() {
      const styleContents: string[] = [];
      
      const styleTags = Array.from(document.querySelectorAll('style'));
      for (const style of styleTags) {
        if (style.textContent) {
          styleContents.push(style.textContent);
        }
      }
      
      const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of linkTags) {
        try {
          const href = (link as HTMLLinkElement).href;
          if (href) {
            const response = await fetch(href);
            if (response.ok) {
              const text = await response.text();
              styleContents.push(text);
            }
          }
        } catch (e) {
          console.warn("Could not fetch external stylesheet:", e);
        }
      }
      
      return styleContents;
    }

    const elements = Array.from(document.querySelectorAll('*'));
    let targetElement: Element | null = null;
    let pseudoType: '::before' | '::after' | null = null;
    let propertyUsed: 'content' | 'background-image' | null = null;
    
    for (const el of elements) {
      const beforeStyle = window.getComputedStyle(el, '::before');
      const beforeContent = beforeStyle.content;
      const beforeBg = beforeStyle.backgroundImage;
      
      const afterStyle = window.getComputedStyle(el, '::after');
      const afterContent = afterStyle.content;
      const afterBg = afterStyle.backgroundImage;
      
      if (beforeContent && beforeContent !== 'none' && beforeContent !== 'normal') {
        targetElement = el;
        pseudoType = '::before';
        propertyUsed = 'content';
        break;
      }
      if (beforeBg && beforeBg !== 'none') {
        targetElement = el;
        pseudoType = '::before';
        propertyUsed = 'background-image';
        break;
      }
      if (afterContent && afterContent !== 'none' && afterContent !== 'normal') {
        targetElement = el;
        pseudoType = '::after';
        propertyUsed = 'content';
        break;
      }
      if (afterBg && afterBg !== 'none') {
        targetElement = el;
        pseudoType = '::after';
        propertyUsed = 'background-image';
        break;
      }
    }
    
    if (!targetElement || !pseudoType || !propertyUsed) {
      return {
        hasPseudoElement: false,
        hasFallback: false,
        hasImageSetAfterFallback: false,
        hasMultipleDescriptors: false,
        error: "No element with an active ::before or ::after pseudo-element found."
      };
    }
    
    const cssContents = await getCSSContents();
    const allDecls = [];
    for (const css of cssContents) {
      allDecls.push(...getAllDeclarations(css));
    }
    
    const matchingRules = [];
    for (const rule of allDecls) {
      const selectors = rule.selector.split(',').map((s: string) => s.trim());
      for (const sel of selectors) {
        if (sel.toLowerCase().endsWith(pseudoType)) {
          const baseSelector = sel.substring(0, sel.length - pseudoType.length).trim();
          try {
            if (targetElement.matches(baseSelector || '*')) {
              matchingRules.push(rule);
              break;
            }
          } catch (e) {
            // invalid selector syntax or matches error
          }
        }
      }
    }
    
    if (matchingRules.length === 0) {
      return {
        hasPseudoElement: true,
        hasFallback: false,
        hasImageSetAfterFallback: false,
        hasMultipleDescriptors: false,
        error: `Found target element but no matching CSS rule for its ${pseudoType} pseudo-element was found in style tags or stylesheets.`
      };
    }
    
    const allParsedDecls = [];
    for (const rule of matchingRules) {
      const decls = rule.blockContent.split(';').map((d: string) => d.trim()).filter(Boolean);
      for (const decl of decls) {
        const colonIndex = decl.indexOf(':');
        if (colonIndex !== -1) {
          const property = decl.substring(0, colonIndex).trim().toLowerCase();
          const value = decl.substring(colonIndex + 1).trim();
          allParsedDecls.push({ property, value });
        }
      }
    }
    
    const checkProperties = propertyUsed === 'content' ? ['content'] : ['background-image', 'background'];
    
    let hasFallback = false;
    let hasImageSetAfterFallback = false;
    let imageSetValue: string | null = null;
    
    for (const prop of checkProperties) {
      const propDecls = allParsedDecls.filter(d => d.property === prop);
      const fallbackIndex = propDecls.findIndex(d => d.value.toLowerCase().includes('url(') && !d.value.toLowerCase().includes('image-set(') && !d.value.toLowerCase().includes('-webkit-image-set('));
      if (fallbackIndex !== -1) {
        hasFallback = true;
        const imageSetDecl = propDecls.slice(fallbackIndex + 1).find(d => d.value.toLowerCase().includes('image-set(') || d.value.toLowerCase().includes('-webkit-image-set('));
        if (imageSetDecl) {
          hasImageSetAfterFallback = true;
          imageSetValue = imageSetDecl.value;
          break;
        }
      }
    }
    
    let hasMultipleDescriptors = false;
    if (imageSetValue) {
      let inner = imageSetValue;
      const match = imageSetValue.match(/(?:-webkit-)?image-set\(([\s\S]*)\)/i);
      if (match) {
        inner = match[1];
      }
      
      const descriptorRegex = /\b\d+(?:\.\d+)?(?:x|dpi|dppx)\b/gi;
      const descriptors = inner.match(descriptorRegex) || [];
      const uniqueDescriptors = new Set(descriptors.map(d => d.toLowerCase()));
      if (uniqueDescriptors.size >= 2) {
        hasMultipleDescriptors = true;
      }
    }
    
    return {
      hasPseudoElement: true,
      hasFallback,
      hasImageSetAfterFallback,
      hasMultipleDescriptors,
      error: null
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(`file://${targetFile}`);
});

test('A pseudo-element (::before or ::after) is used on a target element', async ({ page }) => {
  const result = await runEvaluation(page);
  expect(result.hasPseudoElement).toBe(true);
});

test('The pseudo-element has a standard image declaration acting as a fallback for the content or background-image property', async ({ page }) => {
  const result = await runEvaluation(page);
  expect(result.hasFallback).toBe(true);
});

test('The pseudo-element uses the image-set() function for the same property, defined after the fallback', async ({ page }) => {
  const result = await runEvaluation(page);
  expect(result.hasImageSetAfterFallback).toBe(true);
});

test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async ({ page }) => {
  const result = await runEvaluation(page);
  expect(result.hasMultipleDescriptors).toBe(true);
});
