import { test, expect } from '@playwright/test';

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
  });
  await page.goto(targetUrl);
  
  let threwError = false;
  page.on('pageerror', () => {
    threwError = true;
  });

  await page.fill('#search-input', '[');
  // Wait a small moment to let event handlers run
  await page.waitForTimeout(100);

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
