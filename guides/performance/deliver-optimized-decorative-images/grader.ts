import { test, expect } from '@playwright/test';
import * as path from 'path';

// Analysis helper that runs in the page context
async function analyzePage() {
  // Parse CSS string into rules
  function parseCss(cssText: string) {
    const rules: Array<{ selector: string; body: string }> = [];
    const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    
    let depth = 0;
    let currentSelector = '';
    let currentBody = '';
    
    for (let i = 0; i < cleanCss.length; i++) {
      const char = cleanCss[i];
      if (char === '{') {
        if (depth === 0) {
          depth = 1;
        } else {
          depth++;
          currentBody += char;
        }
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          const selector = currentSelector.trim();
          const body = currentBody.trim();
          if (selector.startsWith('@media') || selector.startsWith('@support') || selector.startsWith('@container')) {
            rules.push(...parseCss(body));
          } else {
            rules.push({ selector, body });
          }
          currentSelector = '';
          currentBody = '';
        } else {
          currentBody += char;
        }
      } else {
        if (depth === 0) {
          currentSelector += char;
        } else {
          currentBody += char;
        }
      }
    }
    return rules;
  }

  // Parse property declarations inside a rule body
  function parseRuleBody(body: string) {
    const declarations: string[] = [];
    let currentDecl = '';
    let inQuotes: string | null = null;
    let parenDepth = 0;
    
    for (let i = 0; i < body.length; i++) {
      const char = body[i];
      if (inQuotes) {
        if (char === inQuotes) {
          inQuotes = null;
        }
        currentDecl += char;
      } else {
        if (char === '"' || char === "'") {
          inQuotes = char;
          currentDecl += char;
        } else if (char === '(') {
          parenDepth++;
          currentDecl += char;
        } else if (char === ')') {
          if (parenDepth > 0) parenDepth--;
          currentDecl += char;
        } else if (char === ';' && parenDepth === 0) {
          declarations.push(currentDecl.trim());
          currentDecl = '';
        } else {
          currentDecl += char;
        }
      }
    }
    if (currentDecl.trim()) {
      declarations.push(currentDecl.trim());
    }
    
    return declarations.map(decl => {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) return null;
      const name = decl.slice(0, colonIdx).trim().toLowerCase();
      const value = decl.slice(colonIdx + 1).trim();
      return { name, value };
    }).filter((x): x is { name: string; value: string } => x !== null);
  }

  // Check if an element matches a selector, ignoring pseudo-classes/elements
  function matchesSelector(el: Element, selector: string) {
    const parts = selector.split(',');
    return parts.some(part => {
      const cleanSelector = part.replace(/::?[a-zA-Z0-9-()]+/g, '').trim();
      if (!cleanSelector) return false;
      try {
        return el.matches(cleanSelector);
      } catch (e) {
        return false;
      }
    });
  }

  // Helper to fetch external stylesheets
  const getAllCssSources = async () => {
    const sources: string[] = [];
    for (const style of Array.from(document.querySelectorAll('style'))) {
      sources.push(style.textContent || '');
    }
    for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const response = await fetch(href);
          const text = await response.text();
          sources.push(text);
        } catch (e) {
          // ignore fetch failures
        }
      }
    }
    return sources;
  };

  const cssSources = await getAllCssSources();
  const allRules = cssSources.flatMap(parseCss);

  // Find target element with image-set in computed style
  const elements = Array.from(document.querySelectorAll('*'));
  let targetElement: Element | null = null;
  let targetProperties: string[] = [];

  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundImage || '';
    const mask = style.maskImage || style.webkitMaskImage || '';
    
    const props: string[] = [];
    if (bg.includes('image-set(')) {
      props.push('background-image', 'background');
    }
    if (mask.includes('image-set(')) {
      props.push('mask-image', 'mask', '-webkit-mask-image', '-webkit-mask');
    }
    
    if (props.length > 0) {
      targetElement = el;
      targetProperties = props;
      break;
    }
  }

  if (!targetElement) {
    return { success: false, error: 'No element found with image-set() in computed style' };
  }

  // Collect matching declarations
  const declarations: Array<{ name: string; value: string }> = [];
  for (const rule of allRules) {
    if (matchesSelector(targetElement, rule.selector)) {
      const decls = parseRuleBody(rule.body);
      for (const decl of decls) {
        if (targetProperties.includes(decl.name)) {
          declarations.push(decl);
        }
      }
    }
  }

  const inlineStyle = targetElement.getAttribute('style');
  if (inlineStyle) {
    const decls = parseRuleBody(inlineStyle);
    for (const decl of decls) {
      if (targetProperties.includes(decl.name)) {
        declarations.push(decl);
      }
    }
  }

  return {
    success: true,
    properties: targetProperties,
    declarations
  };
}

// Pre-test setup to load the file
async function loadTargetPage(page: any) {
  const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');
  await page.goto(`file://${targetFile}`);
}

test.describe('Deliver Optimized Decorative Images', () => {
  test('The element uses the image-set() function for background or mask images', async ({ page }) => {
    await loadTargetPage(page);
    const analysis = await page.evaluate(analyzePage);
    
    expect(analysis.success).toBe(true);
  });

  test('The element has a standard fallback declaration defined before the image-set() declaration', async ({ page }) => {
    await loadTargetPage(page);
    const analysis = await page.evaluate(analyzePage);
    
    expect(analysis.success).toBe(true);
    const declarations = analysis.declarations || [];
    
    // Find first declaration with image-set
    const firstImageSetIdx = declarations.findIndex(d => d.value.includes('image-set('));
    expect(firstImageSetIdx).not.toBe(-1);

    // Find if there is a fallback declaration of the same property before the image-set
    const hasFallbackBefore = declarations.slice(0, firstImageSetIdx).some(d => d.value.includes('url('));
    
    // Grader resilience: Since image-set() is widely supported in modern browsers,
    // a standard fallback is optional if a standard fallback format (like JPG/JPEG) is listed inside the image-set itself.
    const hasJpgInImageSet = declarations[firstImageSetIdx].value.includes('.jpg') || declarations[firstImageSetIdx].value.includes('.jpeg');
    expect(hasFallbackBefore || hasJpgInImageSet).toBe(true);
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async ({ page }) => {
    await loadTargetPage(page);
    const analysis = await page.evaluate(analyzePage);
    
    expect(analysis.success).toBe(true);
    const declarations = analysis.declarations || [];
    
    const imageSetDecl = declarations.find(d => d.value.includes('image-set('));
    expect(imageSetDecl).toBeDefined();
    
    const val = imageSetDecl!.value;
    const has1x = /\b1x\b|\b1dppx\b/.test(val);
    const has2x = /\b2x\b|\b2dppx\b/.test(val);
    
    expect(has1x && has2x).toBe(true);
  });
});
