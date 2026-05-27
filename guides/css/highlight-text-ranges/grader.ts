
import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(__dirname, 'demo.html');

test.describe('CSS Custom Highlight API', () => {
  test.beforeEach(async ({ page }) => {
    // Instrument browser APIs before the page loads
    await page.addInitScript(() => {
      (window as any).__registrations = [];
      (window as any).__clears = 0;
      (window as any).__rangeCalls = [];
      (window as any).__treeWalkerCalls = [];
      (window as any).__highlightConstructorCalls = [];
      (window as any).__featureDetectionChecked = false;
      (window as any).__innerHTMLSetCount = 0;

      // Track innerHTML sets
      const originalDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (originalDescriptor && originalDescriptor.set) {
          Object.defineProperty(Element.prototype, 'innerHTML', {
              set(value) {
                  (window as any).__innerHTMLSetCount++;
                  return originalDescriptor.set!.call(this, value);
              },
              get() {
                  return originalDescriptor.get!.call(this);
              },
              configurable: true
          });
      }

      // Mock CSS.highlights if it exists
      if (window.CSS && (window.CSS as any).highlights) {
        const originalSet = (window.CSS as any).highlights.set.bind((window.CSS as any).highlights);
        (window.CSS as any).highlights.set = (name: string, highlight: any) => {
          (window as any).__registrations.push({ name, highlight });
          return originalSet(name, highlight);
        };

        const originalClear = (window.CSS as any).highlights.clear.bind((window.CSS as any).highlights);
        (window.CSS as any).highlights.clear = () => {
          (window as any).__clears++;
          return originalClear();
        };

        // Track feature detection
        const originalHighlights = (window.CSS as any).highlights;
        Object.defineProperty(window.CSS, 'highlights', {
            get() {
                (window as any).__featureDetectionChecked = true;
                return originalHighlights;
            },
            configurable: true
        });
      }

      // Mock Range.prototype.setStart/End
      const originalSetStart = Range.prototype.setStart;
      Range.prototype.setStart = function(node, offset) {
        (window as any).__rangeCalls.push({ type: 'start', node, offset, nodeType: node.nodeType });
        return originalSetStart.apply(this, [node, offset]);
      };

      const originalSetEnd = Range.prototype.setEnd;
      Range.prototype.setEnd = function(node, offset) {
        (window as any).__rangeCalls.push({ type: 'end', node, offset, nodeType: node.nodeType });
        return originalSetEnd.apply(this, [node, offset]);
      };

      // Mock Highlight constructor
      const OriginalHighlight = (window as any).Highlight;
      if (OriginalHighlight) {
          (window as any).Highlight = function(...ranges: any[]) {
            (window as any).__highlightConstructorCalls.push(ranges);
            return new OriginalHighlight(...ranges);
          };
          (window as any).Highlight.prototype = OriginalHighlight.prototype;
      }

      // Mock TreeWalker
      const originalCreateTreeWalker = document.createTreeWalker;
      document.createTreeWalker = function(root, whatToShow, filter) {
        (window as any).__treeWalkerCalls.push({ root, whatToShow, filter });
        return originalCreateTreeWalker.apply(this, [root, whatToShow, filter]);
      };
    });

    await page.goto(`file://${targetFile}`);
  });

  test('should use ::highlight() pseudo-element in CSS', async ({ page }) => {
    const hasHighlightRule = await page.evaluate(() => {
      return Array.from(document.styleSheets).some(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => {
            return rule.cssText.includes('::highlight');
          });
        } catch (e) {
          return false;
        }
      });
    });
    expect(hasHighlightRule).toBe(true);
  });

  test('should call CSS.highlights.set() to register a highlight', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('API');
    
    const registrations = await page.evaluate(() => (window as any).__registrations);
    expect(registrations.length).toBeGreaterThan(0);
  });

  test('should construct Highlight objects from Range objects', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('the');
    
    const constructorCalls = await page.evaluate(() => (window as any).__highlightConstructorCalls);
    expect(constructorCalls.length).toBeGreaterThan(0);
    const firstCallArgsAreRanges = await page.evaluate(() => {
        return (window as any).__highlightConstructorCalls[0] && 
               (window as any).__highlightConstructorCalls[0].every((arg: any) => arg instanceof Range);
    });
    expect(firstCallArgsAreRanges).toBe(true);
  });

  test('should set Range start and end on text nodes', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('document');
    
    const rangeCalls = await page.evaluate(() => (window as any).__rangeCalls);
    expect(rangeCalls.length).toBeGreaterThan(0);
    
    const allOnTextNodes = rangeCalls.every((call: any) => call.nodeType === 3); // Node.TEXT_NODE
    expect(allOnTextNodes).toBe(true);
  });

  test('should call CSS.highlights.clear() before recalculating', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('search');
    await input.fill('search result');
    
    const clears = await page.evaluate(() => (window as any).__clears);
    expect(clears).toBeGreaterThan(0);
  });

  test('should only use allowable CSS properties inside ::highlight()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const forbidden = ['font-size', 'padding', 'margin', 'background-image', 'display', 'position'];
      let foundAny = false;
      let foundForbidden = false;
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule.cssText.includes('::highlight')) {
              foundAny = true;
              const style = (rule as CSSStyleRule).style;
              if (forbidden.some(prop => style.getPropertyValue(prop) !== '')) {
                foundForbidden = true;
              }
            }
          });
        } catch (e) {}
      });
      return { foundAny, foundForbidden };
    });
    expect(result.foundAny).toBe(true);
    expect(result.foundForbidden).toBe(false);
  });

  test('should use TreeWalker with NodeFilter.SHOW_TEXT and NOT use innerHTML', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('mechanism');
    
    const treeWalkerCalls = await page.evaluate(() => (window as any).__treeWalkerCalls);
    const innerHTMLSetCount = await page.evaluate(() => (window as any).__innerHTMLSetCount);
    
    expect(treeWalkerCalls.length).toBeGreaterThan(0);
    expect(innerHTMLSetCount).toBe(0);
    
    const usesShowText = treeWalkerCalls.some((call: any) => (call.whatToShow & 4) !== 0);
    expect(usesShowText).toBe(true);
  });

  test('should check for CSS.highlights feature support', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('a');
    
    const checked = await page.evaluate(() => (window as any).__featureDetectionChecked);
    expect(checked).toBe(true);
  });

  test('should have a fallback strategy for unsupported browsers that avoids innerHTML', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(CSS, 'highlights', {
        get() { return undefined; },
        configurable: true
      });
    });
    await page.reload();
    
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('mechanism'); // Using a word that is in both demo and negative-demo to ensure fallback is triggered
    
    const fallbackCount = await page.evaluate(() => {
      return document.querySelectorAll('mark, span[class*="match"], span[class*="highlight"]').length;
    });
    const innerHTMLSetCount = await page.evaluate(() => (window as any).__innerHTMLSetCount);

    expect(fallbackCount).toBeGreaterThan(0);
    // Demo restores innerHTML once when switching to fallback, but should not use it for updates.
    expect(innerHTMLSetCount).toBeLessThan(5);
  });

  test('should avoid XSS and regex injection in fallback', async ({ page }) => {
    const errors: any[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.addInitScript(() => {
        Object.defineProperty(CSS, 'highlights', {
          get() { return undefined; },
          configurable: true
        });
      });
      await page.reload();

    const input = page.locator('input[type="text"], #search-input');
    
    // Test regex injection - should NOT throw an error if properly escaped
    await input.fill('(');
    await page.waitForTimeout(100);
    expect(errors.length).toBe(0);
    
    // Test XSS
    const xssPayload = '<img src=x onerror=window.__xss=true>';
    await input.fill(xssPayload);
    await page.waitForTimeout(100);
    const xssTriggered = await page.evaluate(() => (window as any).__xss === true);
    expect(xssTriggered).toBe(false);
  });

  test('should visually change the appearance of matched text', async ({ page }) => {
    const input = page.locator('input[type="text"], #search-input');
    await input.fill('text');
    
    const hasRanges = await page.evaluate(() => {
        if (!CSS.highlights) return false;
        const hl = CSS.highlights.get('search-results');
        return !!(hl && hl.size > 0);
    });
    expect(hasRanges).toBe(true);
  });

});
