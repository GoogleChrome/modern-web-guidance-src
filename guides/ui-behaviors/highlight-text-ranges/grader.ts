import { test, expect, expectNever } from '../../test-fixture.ts';

declare const process: any;

const targetFile = process.env.TARGET_FILE || '';
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}
const targetUrl = targetFile.startsWith('http') ? targetFile : `file://${targetFile}`;

async function getSearchTerm(page: any): Promise<string> {
  return await page.evaluate(() => {
    const container = document.getElementById('content') || document.querySelector('.grid') || document.body;
    const text = container.textContent || '';
    const matches = text.match(/[a-zA-Z]{5,10}/g) || [];
    return matches.length > 0 ? matches[0] : 'latte';
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__instrumentation = {
      highlightsSetCalled: false,
      highlightsClearCalled: false,
      highlightsDeleteCalled: false,
      highlightConstructorCalled: false,
      rangesUsedInHighlight: [],
      rangeSetStartOnTextNode: false,
      rangeSetEndOnTextNode: false,
      rangeSetStartElementNode: false,
      rangeSetEndElementNode: false,
      treeWalkerCreatedWithShowText: false,
      treeWalkerMethodsCalled: false,
      innerHTMLSetOnArticle: false,
      featureDetectionChecked: false,
    };

    // Instrument CSS.highlights if supported
    if (window.CSS && (window.CSS as any).highlights) {
      let val = (window.CSS as any).highlights;
      Object.defineProperty(window.CSS, 'highlights', {
        get() {
          (window as any).__instrumentation.featureDetectionChecked = true;
          return val;
        },
        set(newVal) {
          val = newVal;
        },
        configurable: true
      });

      const originalSet = val.set;
      val.set = function(name: string, highlight: any) {
        (window as any).__instrumentation.highlightsSetCalled = true;
        return originalSet.call(this, name, highlight);
      };

      const originalClear = val.clear;
      val.clear = function() {
        (window as any).__instrumentation.highlightsClearCalled = true;
        return originalClear.call(this);
      };

      const originalDelete = val.delete;
      val.delete = function(name: string) {
        (window as any).__instrumentation.highlightsDeleteCalled = true;
        return originalDelete.call(this, name);
      };
    }

    // Instrument Highlight constructor
    if ((window as any).Highlight) {
      const OriginalHighlight = (window as any).Highlight;
      (window as any).Highlight = function(...ranges: any[]) {
        (window as any).__instrumentation.highlightConstructorCalled = true;
        (window as any).__instrumentation.rangesUsedInHighlight.push(...ranges);
        return new OriginalHighlight(...ranges);
      };
      (window as any).Highlight.prototype = OriginalHighlight.prototype;
      Object.setPrototypeOf((window as any).Highlight, OriginalHighlight);
    }

    // Instrument Range prototype
    const originalSetStart = Range.prototype.setStart;
    Range.prototype.setStart = function(node, offset) {
      if (node && node.nodeType === Node.TEXT_NODE) {
        (window as any).__instrumentation.rangeSetStartOnTextNode = true;
      } else if (node && node.nodeType === Node.ELEMENT_NODE) {
        (window as any).__instrumentation.rangeSetStartElementNode = true;
      }
      return originalSetStart.call(this, node, offset);
    };

    const originalSetEnd = Range.prototype.setEnd;
    Range.prototype.setEnd = function(node, offset) {
      if (node && node.nodeType === Node.TEXT_NODE) {
        (window as any).__instrumentation.rangeSetEndOnTextNode = true;
      } else if (node && node.nodeType === Node.ELEMENT_NODE) {
        (window as any).__instrumentation.rangeSetEndElementNode = true;
      }
      return originalSetEnd.call(this, node, offset);
    };

    // Instrument createTreeWalker
    const originalCreateTreeWalker = document.createTreeWalker;
    document.createTreeWalker = function(root, whatToShow, filter) {
      if (whatToShow === NodeFilter.SHOW_TEXT) {
        (window as any).__instrumentation.treeWalkerCreatedWithShowText = true;
      }
      const walker = originalCreateTreeWalker.call(this, root, whatToShow, filter);
      const originalNextNode = walker.nextNode;
      walker.nextNode = function() {
        (window as any).__instrumentation.treeWalkerMethodsCalled = true;
        return originalNextNode.call(this);
      };
      return walker;
    };

    // Instrument Element.prototype.innerHTML setter
    const originalHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalHTMLDescriptor && originalHTMLDescriptor.set) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        ...originalHTMLDescriptor,
        set: function(value) {
          if (this.id === 'content' || this.tagName === 'ARTICLE') {
            (window as any).__instrumentation.innerHTMLSetOnArticle = true;
          }
          return (originalHTMLDescriptor.set as any).call(this, value);
        }
      });
    }
  });
});

test('::highlight() pseudo-element is used in CSS to style at least one named highlight', async ({ page }) => {
  await page.goto(targetUrl);
  const hasHighlightStyle = await page.evaluate(() => {
    let found = false;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('::highlight(')) {
            found = true;
            break;
          }
        }
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    }
    return found;
  });
  expect(hasHighlightStyle).toBe(true);
});

test('CSS.highlights.set() is called to register at least one Highlight object in the HighlightRegistry', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const highlightsSetCalled = await page.evaluate(() => (window as any).__instrumentation.highlightsSetCalled);
  expect(highlightsSetCalled).toBe(true);
});

test('Highlight objects are constructed from one or more Range objects', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const results = await page.evaluate(() => {
    const ranges = (window as any).__instrumentation.rangesUsedInHighlight;
    return {
      called: (window as any).__instrumentation.highlightConstructorCalled,
      hasRange: ranges.length > 0
    };
  });
  expect(results.called && results.hasRange).toBe(true);
});

test('Range objects have their start and end set on text nodes and not element nodes', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const results = await page.evaluate(() => {
    const instr = (window as any).__instrumentation;
    return instr.rangeSetStartOnTextNode && 
           instr.rangeSetEndOnTextNode && 
           !instr.rangeSetStartElementNode && 
           !instr.rangeSetEndElementNode;
  });
  expect(results).toBe(true);
});

test('CSS.highlights.clear() is called before recalculating highlights to prevent stale ranges', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const cleared = await page.evaluate(() => 
    (window as any).__instrumentation.highlightsClearCalled || 
    (window as any).__instrumentation.highlightsDeleteCalled
  );
  expect(cleared).toBe(true);
});

test('Only allowable CSS properties are used inside ::highlight()', async ({ page }) => {
  await page.goto(targetUrl);
  const invalidHighlightProperties = await page.evaluate(() => {
    const allowed = [
      'color', 'background-color', 'background',
      'text-decoration', 'text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness',
      'text-shadow', '-webkit-text-stroke-color', '-webkit-text-fill-color', '-webkit-text-stroke-width',
      'stroke', 'fill'
    ];
    let invalidProps: string[] = [];
    let foundHighlightRule = false;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('::highlight(')) {
            foundHighlightRule = true;
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (!allowed.includes(prop)) {
                invalidProps.push(prop);
              }
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin stylesheets
      }
    }
    if (!foundHighlightRule) {
      return ['no-highlight-rule-found'];
    }
    return invalidProps;
  });
  expect(invalidHighlightProperties.length).toBe(0);
});

test('Text nodes are collected using TreeWalker with NodeFilter.SHOW_TEXT without manipulating innerHTML', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const results = await page.evaluate(() => {
    const instr = (window as any).__instrumentation;
    return instr.treeWalkerCreatedWithShowText && !instr.innerHTMLSetOnArticle;
  });
  expect(results).toBe(true);
});

test('Feature detection checks for CSS.highlights before using the API', async ({ page }) => {
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  const featureDetectionChecked = await page.evaluate(() => (window as any).__instrumentation.featureDetectionChecked);
  expect(featureDetectionChecked).toBe(true);
});

test('A fallback strategy is implemented for browsers that do not support the API', async ({ page }) => {
  // Override CSS.highlights to undefined to simulate lack of support
  await page.addInitScript(() => {
    if (window.CSS) {
      delete (window.CSS as any).highlights;
    }
  });
  await page.goto(targetUrl);
  const term = await getSearchTerm(page);
  await page.fill('#search-input', term);
  
  const hasFallbackMarks = await page.evaluate(() => {
    const marks = document.querySelectorAll('mark');
    return marks.length > 0;
  });
  expect(hasFallbackMarks).toBe(true);
});

test('If the fallback builds matches dynamically search input is escaped or inserted via textContent to avoid injection', async ({ page }) => {
  // Override CSS.highlights to undefined to simulate lack of support
  await page.addInitScript(() => {
    if (window.CSS) {
      delete (window.CSS as any).highlights;
    }
    (window as any).__threwError = false;
    window.addEventListener('error', () => {
      (window as any).__threwError = true;
    });
  });
  await page.goto(targetUrl);
  
  let threwError = false;
  page.on('pageerror', () => {
    threwError = true;
  });

  await page.fill('#search-input', '[');
  await expectNever(page, () => Boolean((window as any).__threwError), { forMs: 150 });

  expect(threwError).toBe(false);
});

test('The highlight visually changes the appearance of matched text', async ({ page }) => {
  await page.goto(targetUrl);
  const hasVisualHighlightStyles = await page.evaluate(() => {
    let hasVisual = false;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('::highlight(')) {
            const style = rule.style;
            if (
              style.getPropertyValue('background-color') ||
              style.getPropertyValue('background') ||
              style.getPropertyValue('color') ||
              style.getPropertyValue('text-decoration') ||
              style.getPropertyValue('text-shadow')
            ) {
              hasVisual = true;
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin stylesheets
      }
    }
    return hasVisual;
  });
  expect(hasVisualHighlightStyles).toBe(true);
});

const contrastHelperScript = `
  function parseColorToRgba(colorStr, referenceEl) {
    if (!colorStr || colorStr === 'transparent') return [0, 0, 0, 0];
    const probe = document.createElement('span');
    probe.style.color = colorStr;
    probe.style.display = 'none';
    (referenceEl || document.body).appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const rgbMatch = computed.match(/^rgba?\\((\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?)(?:,\\s*(\\d+(?:\\.\\d+)?))?\\)/);
    if (rgbMatch) {
      return [
        Number(rgbMatch[1]) / 255,
        Number(rgbMatch[2]) / 255,
        Number(rgbMatch[3]) / 255,
        rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
      ];
    }
    const srgbMatch = computed.match(/^color\\(srgb\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)(?:\\s*\\/\\s*(\\d+(?:\\.\\d+)?))?\\)/);
    if (srgbMatch) {
      return [
        Number(srgbMatch[1]),
        Number(srgbMatch[2]),
        Number(srgbMatch[3]),
        srgbMatch[4] !== undefined ? Number(srgbMatch[4]) : 1,
      ];
    }
    return null;
  }
  function blendOver(fg, bg) {
    const a = fg[3];
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
      1,
    ];
  }
  function luminance(rgba) {
    const lin = rgba.slice(0, 3).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(c1);
    const l2 = luminance(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function getEffectiveBackground(el) {
    let bg = [1, 1, 1, 1];
    const chain = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      chain.unshift(cur);
      cur = cur.parentElement;
    }
    for (const node of chain) {
      const parsed = parseColorToRgba(getComputedStyle(node).backgroundColor, node);
      if (parsed && parsed[3] > 0) {
        bg = blendOver(parsed, bg);
      }
    }
    return bg;
  }
  function getHighlightRules() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes('::highlight(')) {
            rules.push(rule);
          }
        }
      } catch {}
    }
    return rules;
  }
`;

test('There is sufficient contrast (4.5:1 or 3:1 for large text) between matched text and highlight color', async ({ page }) => {
  await page.goto(targetUrl);
  const analysis = await page.evaluate((helperSrc) => {
    const fn = new Function(helperSrc + `
      const rules = getHighlightRules();
      const targetEl = document.querySelector('article p, article, main p, main, p') || document.body;
      const targetStyle = getComputedStyle(targetEl);
      const fontSizePx = parseFloat(targetStyle.fontSize) || 16;
      const fontWeight = parseInt(targetStyle.fontWeight, 10) || 400;
      const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
      const requiredRatio = isLargeText ? 3.0 : 4.5;
      const pageBg = getEffectiveBackground(targetEl);
      const defaultFg = parseColorToRgba(targetStyle.color, targetEl) || [0, 0, 0, 1];

      const results = rules.map((rule) => {
        const bgRaw = rule.style.getPropertyValue('background-color') || rule.style.getPropertyValue('background');
        const fgRaw = rule.style.getPropertyValue('color');
        const bgParsed = bgRaw ? parseColorToRgba(bgRaw, targetEl) : null;
        const effectiveHighlightBg = bgParsed && bgParsed[3] > 0 ? blendOver(bgParsed, pageBg) : pageBg;
        const fgParsed = fgRaw ? parseColorToRgba(fgRaw, targetEl) : defaultFg;
        const effectiveFg = fgParsed ? blendOver(fgParsed, effectiveHighlightBg) : defaultFg;
        const ratio = contrastRatio(effectiveFg, effectiveHighlightBg);
        return { selector: rule.selectorText, ratio, requiredRatio };
      });
      return { ruleCount: rules.length, results };
    `);
    return fn();
  }, contrastHelperScript);

  expect(analysis.ruleCount).toBeGreaterThan(0);
  expect(analysis.results.every((r: any) => r.ratio >= r.requiredRatio)).toBe(true);
});

test('There is at least 3:1 contrast between highlight color and adjacent colors OR non-color styling is applied', async ({ page }) => {
  await page.goto(targetUrl);
  const analysis = await page.evaluate((helperSrc) => {
    const fn = new Function(helperSrc + `
      const rules = getHighlightRules();
      const targetEl = document.querySelector('article p, article, main p, main, p') || document.body;
      const pageBg = getEffectiveBackground(targetEl);

      const results = rules.map((rule) => {
        const bgRaw = rule.style.getPropertyValue('background-color') || rule.style.getPropertyValue('background');
        const bgParsed = bgRaw ? parseColorToRgba(bgRaw, targetEl) : null;
        const effectiveHighlightBg = bgParsed && bgParsed[3] > 0 ? blendOver(bgParsed, pageBg) : pageBg;
        const adjacentContrast = contrastRatio(effectiveHighlightBg, pageBg);
        const textDec = rule.style.getPropertyValue('text-decoration') || rule.style.getPropertyValue('text-decoration-line');
        const textShadow = rule.style.getPropertyValue('text-shadow');
        const strokeWidth = rule.style.getPropertyValue('-webkit-text-stroke-width');
        const hasNonColorStyling =
          (textDec && textDec !== 'none') ||
          (textShadow && textShadow !== 'none') ||
          (strokeWidth && parseFloat(strokeWidth) > 0);
        return {
          selector: rule.selectorText,
          adjacentContrast,
          hasNonColorStyling: Boolean(hasNonColorStyling),
        };
      });
      return { ruleCount: rules.length, results };
    `);
    return fn();
  }, contrastHelperScript);

  expect(analysis.ruleCount).toBeGreaterThan(0);
  expect(analysis.results.every((r: any) => r.adjacentContrast >= 3.0 || r.hasNonColorStyling)).toBe(true);
});

test('Highlights do not rely on color alone to convey meaning', async ({ page }) => {
  await page.goto(targetUrl);
  const analysis = await page.evaluate((helperSrc) => {
    const fn = new Function(helperSrc + `
      const rules = getHighlightRules();
      const targetEl = document.querySelector('article p, article, main p, main, p') || document.body;
      const pageBg = getEffectiveBackground(targetEl);

      const results = rules.map((rule) => {
        const selector = rule.selectorText || '';
        const isSemanticMeaning = /error|spell|grammar|warn|invalid|diff|added|removed/i.test(selector);
        const bgRaw = rule.style.getPropertyValue('background-color') || rule.style.getPropertyValue('background');
        const bgParsed = bgRaw ? parseColorToRgba(bgRaw, targetEl) : null;
        const effectiveHighlightBg = bgParsed && bgParsed[3] > 0 ? blendOver(bgParsed, pageBg) : pageBg;
        const adjacentContrast = contrastRatio(effectiveHighlightBg, pageBg);
        const textDec = rule.style.getPropertyValue('text-decoration') || rule.style.getPropertyValue('text-decoration-line');
        const textShadow = rule.style.getPropertyValue('text-shadow');
        const strokeWidth = rule.style.getPropertyValue('-webkit-text-stroke-width');
        const hasNonColorStyling = Boolean(
          (textDec && textDec !== 'none') ||
          (textShadow && textShadow !== 'none') ||
          (strokeWidth && parseFloat(strokeWidth) > 0)
        );
        const passes = isSemanticMeaning || rules.length > 1
          ? hasNonColorStyling
          : (hasNonColorStyling || adjacentContrast >= 3.0);
        return { selector, passes, adjacentContrast, hasNonColorStyling };
      });
      return { ruleCount: rules.length, results };
    `);
    return fn();
  }, contrastHelperScript);

  expect(analysis.ruleCount).toBeGreaterThan(0);
  expect(analysis.results.every((r: any) => r.passes)).toBe(true);
});
